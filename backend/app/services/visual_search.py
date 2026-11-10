"""Local CLIP image indexing and text-to-image search."""
import json
import logging
import threading
from io import BytesIO

from PIL import Image, ImageOps
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models import Event, PreviewImage
from app.db.session import SessionLocal
from app.schemas.api import VisualSearchImageOut
from app.services import storage_service
from app.services.events_view import preview_url

log = logging.getLogger("visual_search")

_MODEL_LOCK = threading.Lock()
_INDEX_LOCK = threading.Lock()
_MODEL = None
_PROCESSOR = None
_INDEX_ACTIVE = False
_INDEX_ERROR: str | None = None
_BATCH_SIZE = 16
_MIN_SIMILARITY = 0.18


class VisualSearchError(Exception):
    """Raised when the local visual-search model or index is unavailable."""


def _get_model():
    global _MODEL, _PROCESSOR
    with _MODEL_LOCK:
        if _MODEL is None:
            try:
                from transformers import CLIPModel, CLIPProcessor

                _PROCESSOR = CLIPProcessor.from_pretrained(
                    settings.VISUAL_SEARCH_MODEL,
                    cache_dir=str(settings.model_cache_dir),
                )
                _MODEL = CLIPModel.from_pretrained(
                    settings.VISUAL_SEARCH_MODEL,
                    cache_dir=str(settings.model_cache_dir),
                ).to("cpu")
                _MODEL.eval()
            except Exception as exc:
                _PROCESSOR = None
                _MODEL = None
                raise VisualSearchError(
                    "The local visual-search model could not be loaded. "
                    "Check backend dependencies and model-cache access."
                ) from exc
        return _MODEL, _PROCESSOR


def _serialize_vector(vector) -> str:
    return json.dumps([round(float(value), 6) for value in vector], separators=(",", ":"))


def _deserialize_vector(value: str) -> list[float]:
    try:
        vector = json.loads(value)
        if not isinstance(vector, list) or not vector:
            raise ValueError
        return [float(item) for item in vector]
    except (TypeError, ValueError, json.JSONDecodeError) as exc:
        raise VisualSearchError("A stored photo index is invalid; rebuild the visual index.") from exc


def encode_text(query: str) -> list[float]:
    try:
        import torch

        model, processor = _get_model()
        inputs = processor(text=[query], padding=True, truncation=True, return_tensors="pt")
        with torch.inference_mode():
            features = model.get_text_features(**inputs)
            features = torch.nn.functional.normalize(features, p=2, dim=-1)
        return [float(value) for value in features[0].tolist()]
    except VisualSearchError:
        raise
    except Exception as exc:
        raise VisualSearchError("The search phrase could not be processed by the local model.") from exc


def _encode_images(image_bytes: list[bytes]) -> list[str]:
    try:
        import torch

        model, processor = _get_model()
        images = []
        for data in image_bytes:
            with Image.open(BytesIO(data)) as image:
                images.append(ImageOps.exif_transpose(image).convert("RGB"))
        inputs = processor(images=images, return_tensors="pt")
        with torch.inference_mode():
            features = model.get_image_features(**inputs)
            features = torch.nn.functional.normalize(features, p=2, dim=-1)
        return [_serialize_vector(vector) for vector in features.tolist()]
    except VisualSearchError:
        raise
    except Exception as exc:
        raise VisualSearchError("A photo could not be indexed by the local model.") from exc


def _index_worker() -> None:
    global _INDEX_ACTIVE, _INDEX_ERROR
    db: Session = SessionLocal()
    error = None
    try:
        while True:
            rows = (
                db.query(PreviewImage)
                .filter(PreviewImage.embedding.is_(None))
                .order_by(PreviewImage.id)
                .limit(_BATCH_SIZE)
                .all()
            )
            if not rows:
                break

            image_bytes = []
            for row in rows:
                if not storage_service.exists(row.relative_path):
                    raise VisualSearchError(f"Preview file for image {row.id} is missing.")
                image_bytes.append(storage_service.read_bytes(row.relative_path))

            embeddings = _encode_images(image_bytes)
            for row, embedding in zip(rows, embeddings):
                row.embedding = embedding
            db.commit()
    except Exception:
        db.rollback()
        log.exception("Visual search indexing failed")
        error = "Some photos could not be indexed. Check the backend logs."
    finally:
        db.close()
        with _INDEX_LOCK:
            _INDEX_ERROR = error
            _INDEX_ACTIVE = False


def start_indexing() -> None:
    """Index photos missing embeddings without delaying app startup or uploads."""
    global _INDEX_ACTIVE, _INDEX_ERROR
    with _INDEX_LOCK:
        if _INDEX_ACTIVE or _INDEX_ERROR:
            return
        _INDEX_ACTIVE = True
        thread = threading.Thread(target=_index_worker, name="visual-search-indexer", daemon=True)
        try:
            thread.start()
        except RuntimeError:
            _INDEX_ACTIVE = False
            raise


def search_images(db: Session, query: str, limit: int) -> list[VisualSearchImageOut]:
    """Rank indexed previews by cosine similarity to a natural-language query."""
    query_vector = encode_text(query)
    rows = (
        db.query(PreviewImage, Event)
        .join(Event, Event.id == PreviewImage.event_id)
        .filter(PreviewImage.embedding.is_not(None))
        .all()
    )
    ranked = []
    for image, event in rows:
        if image.embedding is None:
            continue
        image_vector = _deserialize_vector(image.embedding)
        if len(image_vector) != len(query_vector):
            raise VisualSearchError("The stored photo index is incompatible with the active model.")
        score = sum(left * right for left, right in zip(query_vector, image_vector))
        if score >= _MIN_SIMILARITY:
            ranked.append((score, image, event))

    ranked.sort(key=lambda result: result[0], reverse=True)
    return [
        VisualSearchImageOut(
            id=image.id,
            event_id=event.id,
            event_title=event.title,
            event_date=event.event_date,
            file_name=image.file_name,
            url=preview_url(image),
            width=image.width,
            height=image.height,
            score=round(score, 4),
        )
        for score, image, event in ranked[:limit]
    ]


def index_status(db: Session) -> dict[str, int | bool | str | None]:
    total_count = db.query(PreviewImage).count()
    indexed_count = db.query(PreviewImage).filter(PreviewImage.embedding.is_not(None)).count()
    if indexed_count < total_count:
        start_indexing()
    with _INDEX_LOCK:
        return {
            "indexing": _INDEX_ACTIVE,
            "indexed_count": indexed_count,
            "total_count": total_count,
            "index_error": _INDEX_ERROR,
        }
