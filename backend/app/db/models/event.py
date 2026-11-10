from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.models.user import utcnow
from app.db.session import Base


class Event(Base):
    __tablename__ = "events"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")
    event_date: Mapped[date] = mapped_column(Date)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    assignments: Mapped[list["EditorAssignment"]] = relationship(
        back_populates="event", cascade="all, delete-orphan"
    )
    raw_archive: Mapped["RawArchive | None"] = relationship(
        back_populates="event", uselist=False, cascade="all, delete-orphan"
    )
    edited_archive: Mapped["EditedArchive | None"] = relationship(
        back_populates="event", uselist=False, cascade="all, delete-orphan"
    )
    previews: Mapped[list["PreviewImage"]] = relationship(
        back_populates="event", cascade="all, delete-orphan"
    )


class EditorAssignment(Base):
    __tablename__ = "editor_assignments"
    __table_args__ = (UniqueConstraint("event_id", "editor_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"))
    editor_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))

    event: Mapped[Event] = relationship(back_populates="assignments")


# Imported late to avoid circular import problems in type resolution
from app.db.models.media import EditedArchive, PreviewImage, RawArchive  # noqa: E402,F401
