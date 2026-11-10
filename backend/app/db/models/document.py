import enum
from datetime import datetime

from sqlalchemy import BigInteger, DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.models.user import utcnow
from app.db.session import Base


class DocumentCategory(str, enum.Enum):
    bible_study = "bible_study"
    newsletter = "newsletter"
    bulletin = "bulletin"
    form = "form"
    other = "other"


class DocumentStatus(str, enum.Enum):
    draft = "draft"
    published = "published"


class ChurchDocument(Base):
    __tablename__ = "church_documents"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")
    category: Mapped[DocumentCategory] = mapped_column(Enum(DocumentCategory), index=True)
    status: Mapped[DocumentStatus] = mapped_column(
        Enum(DocumentStatus), default=DocumentStatus.draft, index=True
    )
    original_filename: Mapped[str] = mapped_column(String(150))
    storage_filename: Mapped[str] = mapped_column(String(100), unique=True)
    size_bytes: Mapped[int] = mapped_column(BigInteger)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    author = relationship("User")
