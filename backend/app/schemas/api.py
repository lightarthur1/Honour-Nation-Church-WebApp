from datetime import date, datetime, time, timezone
from urllib.parse import urlsplit

from pydantic import BaseModel, ConfigDict, EmailStr, Field, ValidationInfo, field_serializer, field_validator

from app.db.models import (
    AnnouncementStatus, DocumentCategory, DocumentStatus, EditedStatus, NoticeCategory, NoticeStatus,
    ProgramEventStatus, RawStatus, RequestStatus, Role, StreamKind, StreamProvider, StreamStatus,
)


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class RegisterIn(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=2, max_length=120)
    password: str = Field(min_length=8, max_length=72)


class LoginIn(BaseModel):
    email: str
    password: str


class UserOut(ORM):
    id: int
    email: str
    full_name: str
    role: Role
    totp_enabled: bool = False
    created_at: datetime


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class LoginResponseOut(BaseModel):
    access_token: str | None = None
    token_type: str = "bearer"
    user: UserOut | None = None
    mfa_required: bool = False
    mfa_token: str | None = None


class TwoFactorSetupOut(BaseModel):
    secret: str
    otpauth_uri: str


class MfaLoginIn(BaseModel):
    mfa_token: str
    code: str


class TfaDisableIn(BaseModel):
    password: str
    code: str


class TfaEnableIn(BaseModel):
    code: str


class RoleIn(BaseModel):
    role: Role


class EventIn(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    description: str = ""
    event_date: date


class EditorsIn(BaseModel):
    editor_ids: list[int]


class RawOut(ORM):
    original_name: str
    size_bytes: int
    status: RawStatus
    uploaded_at: datetime


class EditedOut(ORM):
    original_name: str
    size_bytes: int
    image_count: int
    status: EditedStatus
    error: str
    uploaded_at: datetime
    synced: bool = False
    drive_progress: int | None = None


class EventOut(BaseModel):
    id: int
    title: str
    description: str
    event_date: date
    editors: list[UserOut] = []
    raw: RawOut | None = None
    edited: EditedOut | None = None
    preview_count: int = 0
    cover_url: str | None = None


class GalleryEventOut(BaseModel):
    id: int
    title: str
    description: str
    event_date: date
    image_count: int
    cover_url: str | None
    access_status: str  # none | pending | approved | denied | staff


class ImageOut(BaseModel):
    id: int
    file_name: str
    url: str
    width: int
    height: int


class VisualSearchImageOut(BaseModel):
    id: int
    event_id: int
    event_title: str
    event_date: date
    file_name: str
    url: str
    width: int
    height: int
    score: float


class VisualSearchOut(BaseModel):
    images: list[VisualSearchImageOut]
    indexing: bool
    indexed_count: int
    total_count: int
    index_error: str | None = None


class AccessRequestOut(BaseModel):
    id: int
    event_id: int
    event_title: str
    user_id: int
    user_name: str
    user_email: str
    status: RequestStatus
    created_at: datetime
    decided_at: datetime | None


class DecisionIn(BaseModel):
    approve: bool


class AnnouncementIn(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    content: str = Field(min_length=2, max_length=10000)
    status: AnnouncementStatus = AnnouncementStatus.draft
    is_pinned: bool = False


class AnnouncementOut(ORM):
    id: int
    title: str
    content: str
    status: AnnouncementStatus
    is_pinned: bool
    created_at: datetime
    updated_at: datetime
    published_at: datetime | None


class ProgramEventIn(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    description: str = Field(default="", max_length=10000)
    start_date: date
    end_date: date | None = None
    start_time: time | None = None
    end_time: time | None = None
    venue: str = Field(default="", max_length=200)
    status: ProgramEventStatus = ProgramEventStatus.draft
    gallery_event_id: int | None = Field(default=None, gt=0)


class ProgramEventOut(ORM):
    id: int
    title: str
    description: str
    start_date: date
    end_date: date | None
    start_time: time | None
    end_time: time | None
    venue: str
    status: ProgramEventStatus
    poster_url: str | None
    gallery_event_id: int | None
    gallery_event_title: str | None
    created_at: datetime
    updated_at: datetime


class StreamItemIn(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    description: str = Field(default="", max_length=10000)
    provider: StreamProvider
    kind: StreamKind
    url: str = Field(min_length=10, max_length=2048)
    scheduled_at: datetime | None = None
    status: StreamStatus = StreamStatus.draft

    @field_validator("url")
    @classmethod
    def validate_provider_url(cls, value: str, info: ValidationInfo) -> str:
        try:
            parsed = urlsplit(value.strip())
            host = (parsed.hostname or "").lower().rstrip(".")
        except ValueError as exc:
            raise ValueError("Use a secure link from the selected streaming provider") from exc
        allowed_hosts = {
            StreamProvider.zoom: ("zoom.us",),
            StreamProvider.youtube: ("youtube.com", "youtu.be", "youtube-nocookie.com"),
            StreamProvider.facebook: ("facebook.com", "fb.watch"),
        }
        provider = info.data.get("provider")
        if (
            parsed.scheme != "https"
            or not host
            or parsed.username is not None
            or parsed.password is not None
            or provider not in allowed_hosts
            or not any(host == domain or host.endswith(f".{domain}") for domain in allowed_hosts[provider])
        ):
            raise ValueError("Use a secure link from the selected streaming provider")
        return value.strip()

    @field_validator("scheduled_at")
    @classmethod
    def validate_scheduled_at_timezone(cls, value: datetime | None) -> datetime | None:
        if value is not None and value.utcoffset() is None:
            raise ValueError("Scheduled time must include a timezone")
        return value


class StreamItemOut(ORM):
    id: int
    title: str
    description: str
    provider: StreamProvider
    kind: StreamKind
    url: str
    scheduled_at: datetime | None
    status: StreamStatus
    created_at: datetime
    updated_at: datetime

    @field_serializer("scheduled_at")
    def serialize_scheduled_at(self, value: datetime | None) -> datetime | None:
        if value is not None and value.utcoffset() is None:
            return value.replace(tzinfo=timezone.utc)
        return value


class NoticeIn(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    content: str = Field(min_length=2, max_length=10000)
    category: NoticeCategory = NoticeCategory.general
    status: NoticeStatus = NoticeStatus.draft
    is_pinned: bool = False
    expires_on: date | None = None


class NoticeOut(ORM):
    id: int
    title: str
    content: str
    category: NoticeCategory
    status: NoticeStatus
    is_pinned: bool
    expires_on: date | None
    created_at: datetime
    updated_at: datetime


class DocumentUpdateIn(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    description: str = Field(default="", max_length=2000)
    category: DocumentCategory = DocumentCategory.other
    status: DocumentStatus = DocumentStatus.draft


class DocumentOut(ORM):
    id: int
    title: str
    description: str
    category: DocumentCategory
    status: DocumentStatus
    original_filename: str
    size_bytes: int
    created_at: datetime
    updated_at: datetime


class DownloadLinkOut(BaseModel):
    url: str
