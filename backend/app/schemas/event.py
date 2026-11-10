from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.media import EditedArchiveOut, RawArchiveOut
from app.schemas.user import UserBrief


class EventCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=5000)
    event_date: date | None = None


class EventUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=5000)
    event_date: date | None = None


class AssignEditorsIn(BaseModel):
    editor_ids: list[int] = Field(max_length=50)


class EventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: str | None
    event_date: date | None
    created_at: datetime
    editors: list[UserBrief]
    raw_archives: list[RawArchiveOut]
    edited_archives: list[EditedArchiveOut]
