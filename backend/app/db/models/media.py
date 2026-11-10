import enum
from datetime import datetime

from sqlalchemy import BigInteger, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.models.user import utcnow
from app.db.session import Base


class RawStatus(str, enum.Enum):
    available = "available"   # file on server disk
    deleted = "deleted"       # admin freed the space


class EditedStatus(str, enum.Enum):
    processing = "processing"
    synced = "synced"         # previews made and pushed to Drive
    failed = "failed"


class RawArchive(Base):
    """Metadata only. The ZIP itself lives on disk at `stored_path`."""
    __tablename__ = "raw_archives"

    id: Mapped[int] = mapped_column(primary_key=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"), unique=True)
    original_name: Mapped[str] = mapped_column(String(255))
    stored_path: Mapped[str] = mapped_column(String(500))
    size_bytes: Mapped[int] = mapped_column(BigInteger)
    status: Mapped[RawStatus] = mapped_column(Enum(RawStatus), default=RawStatus.available)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    event = relationship("Event", back_populates="raw_archive")


class EditedArchive(Base):
    """Metadata only. The edited ZIP is deleted locally once it is in Drive."""
    __tablename__ = "edited_archives"

    id: Mapped[int] = mapped_column(primary_key=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"), unique=True)
    uploaded_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    original_name: Mapped[str] = mapped_column(String(255))
    size_bytes: Mapped[int] = mapped_column(BigInteger)
    image_count: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[EditedStatus] = mapped_column(Enum(EditedStatus), default=EditedStatus.processing)
    error: Mapped[str] = mapped_column(Text, default="")
    drive_file_id: Mapped[str | None] = mapped_column(String(200), nullable=True)
    drive_download_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    storage_key: Mapped[str | None] = mapped_column(String(500), nullable=True)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    event = relationship("Event", back_populates="edited_archive")


class PreviewImage(Base):
    """Path to a small JPEG preview on disk. Never the image bytes."""
    __tablename__ = "preview_images"

    id: Mapped[int] = mapped_column(primary_key=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"), index=True)
    file_name: Mapped[str] = mapped_column(String(255))
    relative_path: Mapped[str] = mapped_column(String(500))
    width: Mapped[int] = mapped_column(Integer)
    height: Mapped[int] = mapped_column(Integer)
    size_bytes: Mapped[int] = mapped_column(Integer)
    embedding: Mapped[str | None] = mapped_column(Text, nullable=True)

    event = relationship("Event", back_populates="previews")
