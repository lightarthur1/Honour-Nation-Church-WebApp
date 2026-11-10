from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field

from app.db.models import AccessStatus
from app.schemas.user import UserBrief


class AccessState(str, Enum):
    """What the gallery UI needs to render the download button/badge."""

    ANONYMOUS = "anonymous"  # not logged in
    NONE = "none"  # logged in, never asked
    PENDING = "pending"
    APPROVED = "approved"
    DENIED = "denied"
    STAFF = "staff"  # admin / assigned editor: always allowed


class AccessRequestCreate(BaseModel):
    event_id: int
    message: str | None = Field(default=None, max_length=500)


class AccessDecisionIn(BaseModel):
    note: str | None = Field(default=None, max_length=500)


class AccessRequestOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    event_id: int
    event_title: str
    user: UserBrief
    status: AccessStatus
    message: str | None
    created_at: datetime
    decided_at: datetime | None
    decision_note: str | None
