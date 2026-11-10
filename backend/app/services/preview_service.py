"""Pillow preview generation: web-ready JPEGs under PREVIEW_MAX_BYTES."""
import io
from dataclasses import dataclass

from PIL import Image, ImageOps

from app.core.config import settings

Image.MAX_IMAGE_PIXELS = 120_000_000  # decompression-bomb guard


@dataclass
class Preview:
    data: bytes
    width: int
    height: int


def make_preview(raw: bytes) -> Preview:
    with Image.open(io.BytesIO(raw)) as img:
        img = ImageOps.exif_transpose(img)  # respect camera rotation
        if img.mode not in ("RGB",):
            img = img.convert("RGB")

        edge = settings.PREVIEW_MAX_EDGE
        limit = settings.PREVIEW_MAX_BYTES
        while True:
            work = img.copy()
            work.thumbnail((edge, edge), Image.Resampling.LANCZOS)
            for quality in (82, 74, 66, 58, 50, 42):
                buf = io.BytesIO()
                work.save(buf, "JPEG", quality=quality, optimize=True, progressive=True)
                if buf.tell() <= limit:
                    return Preview(buf.getvalue(), *work.size)
            if edge <= 320:  # give up shrinking; return the smallest we made
                return Preview(buf.getvalue(), *work.size)
            edge = int(edge * 0.8)
