import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.models.user import utcnow
from app.db.session import Base


class StreamProvider(str, enum.Enum):
    zoom = "zoom"
    youtube = "youtube"
    facebook = "facebook"


class StreamKind(str, enum.Enum):
    live = "live"
    recording = "recording"


class StreamStatus(str, enum.Enum):
    draft = "draft"
    published = "published"


class StreamItem(Base):
    __tablename__ = "stream_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")
    provider: Mapped[StreamProvider] = mapped_column(Enum(StreamProvider), index=True)
    kind: Mapped[StreamKind] = mapped_column(Enum(StreamKind), index=True)
    url: Mapped[str] = mapped_column(String(2048))
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[StreamStatus] = mapped_column(
        Enum(StreamStatus), default=StreamStatus.draft, index=True
    )
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    author = relationship("User")
