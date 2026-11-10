from datetime import date

from pydantic import BaseModel

from app.schemas.access import AccessState


class GalleryImage(BaseModel):
    id: int
    url: str  # path under /previews; the client prefixes the API origin
    width: int
    height: int
    name: str


class GalleryEventCard(BaseModel):
    id: int
    title: str
    event_date: date | None
    photo_count: int
    cover: GalleryImage | None


class GalleryEventPage(BaseModel):
    items: list[GalleryEventCard]
    total: int
    page: int
    page_size: int


class GalleryEventDetail(BaseModel):
    id: int
    title: str
    description: str | None
    event_date: date | None
    photo_count: int
    images: list[GalleryImage]
    page: int
    page_size: int
    access: AccessState  # the caller's relationship to the high-res download
    download_ready: bool  # a final ZIP exists to download


class DownloadUrlOut(BaseModel):
    download_url: str
    view_url: str | None
