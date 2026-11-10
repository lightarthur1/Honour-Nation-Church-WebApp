import enum
from datetime import date, datetime, time

from sqlalchemy import Date, DateTime, Enum, ForeignKey, String, Text, Time
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.models.user import utcnow
from app.db.session import Base


class ProgramEventStatus(str, enum.Enum):
    draft = "draft"
    published = "published"


class ProgramEvent(Base):
    __tablename__ = "program_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    start_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    end_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    venue: Mapped[str] = mapped_column(String(200), default="")
    status: Mapped[ProgramEventStatus] = mapped_column(
        Enum(ProgramEventStatus), default=ProgramEventStatus.draft, index=True
    )
    poster_filename: Mapped[str | None] = mapped_column(String(100), nullable=True)
    gallery_event_id: Mapped[int | None] = mapped_column(
        ForeignKey("events.id", ondelete="SET NULL"), nullable=True, index=True
    )
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    author = relationship("User")
    gallery_event = relationship("Event", foreign_keys=[gallery_event_id])

    @property
    def poster_url(self) -> str | None:
        return f"/event-posters/{self.poster_filename}" if self.poster_filename else None

    @property
    def gallery_event_title(self) -> str | None:
        return self.gallery_event.title if self.gallery_event else None
