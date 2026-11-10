import enum
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.models.user import utcnow
from app.db.session import Base


class NoticeCategory(str, enum.Enum):
    general = "general"
    service = "service"
    registration = "registration"
    reminder = "reminder"


class NoticeStatus(str, enum.Enum):
    draft = "draft"
    published = "published"


class Notice(Base):
    __tablename__ = "notices"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    content: Mapped[str] = mapped_column(Text)
    category: Mapped[NoticeCategory] = mapped_column(Enum(NoticeCategory), index=True)
    status: Mapped[NoticeStatus] = mapped_column(Enum(NoticeStatus), default=NoticeStatus.draft, index=True)
    is_pinned: Mapped[bool] = mapped_column(Boolean, default=False)
    expires_on: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    author = relationship("User")
