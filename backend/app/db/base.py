from datetime import datetime, timezone

from sqlalchemy import DateTime
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.types import TypeDecorator


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class UTCDateTime(TypeDecorator):
    """SQLite drops tzinfo. This always stores UTC and always returns tz-aware UTC,
    so API timestamps serialize with a 'Z' and the browser localizes them correctly."""

    impl = DateTime
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)


class Base(DeclarativeBase):
    pass


def enum_column(enum_cls):
    """Portable string-backed enum (no native DB enum type), stored by value."""
    return SAEnum(
        enum_cls,
        native_enum=False,
        length=24,
        values_callable=lambda e: [m.value for m in e],
        validate_strings=True,
    )
