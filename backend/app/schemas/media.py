from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.db.models import DriveStatus, PreviewStatus


class RawArchiveOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    event_id: int
    original_filename: str
    size_bytes: int
    file_count: int
    uploaded_at: datetime
    deleted_at: datetime | None
    is_available: bool


class EditedArchiveOut(BaseModel):
    """Staff-facing (admin/editor). Includes Drive links, so never reuse in public routes."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    event_id: int
    original_filename: str
    size_bytes: int
    image_count: int
    preview_count: int
    uploaded_at: datetime
    preview_status: PreviewStatus
    drive_status: DriveStatus
    drive_download_url: str | None
    drive_view_url: str | None
    drive_synced_at: datetime | None
    error_message: str | None


class DownloadLinkOut(BaseModel):
    url: str
    expires_in: int
