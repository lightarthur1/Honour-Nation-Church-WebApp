"""Copy the existing local SQLite records and media into hosted PostgreSQL and R2."""
import logging
import os
from pathlib import Path

from sqlalchemy import create_engine, func, inspect, select, text
from sqlalchemy.engine import URL

from app.core.config import BASE_DIR, settings
from app.core.db_migration import ensure_columns
from app.db import models  # noqa: F401
from app.db.session import Base, engine as target_engine
from app.services import storage_service

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
log = logging.getLogger("migration")
MEDIA_DIRECTORIES = (
    "raw",
    "edited_images",
    "previews",
    "event_posters",
    "documents",
    "edited_tmp",
    "drive_mock",
)


def _copy_media(source_root: Path) -> tuple[int, int]:
    file_count = 0
    total_bytes = 0
    for directory in MEDIA_DIRECTORIES:
        root = source_root / directory
        if not root.exists():
            continue
        for source in root.rglob("*"):
            if source.is_symlink() or not source.is_file():
                continue
            relative = source.relative_to(source_root)
            destination = settings.STORAGE_DIR / relative
            storage_service.store_file(source, destination)
            file_count += 1
            total_bytes += source.stat().st_size
    return file_count, total_bytes


def _ensure_empty_target(destination_engine) -> None:
    tables = Base.metadata.sorted_tables
    with destination_engine.connect() as connection:
        populated = [
            table.name
            for table in tables
            if connection.execute(select(func.count()).select_from(table)).scalar_one()
        ]
    if populated:
        raise RuntimeError(
            "Target PostgreSQL database is not empty; existing data was left untouched: "
            + ", ".join(populated)
        )


def _copy_records(source_engine, destination_engine=target_engine) -> dict[str, int]:
    tables = Base.metadata.sorted_tables
    _ensure_empty_target(destination_engine)
    counts = {}
    with source_engine.connect() as source, destination_engine.begin() as target:
        for table in tables:
            result = source.execute(select(table))
            count = 0
            while rows := result.fetchmany(500):
                target.execute(table.insert(), [dict(row._mapping) for row in rows])
                count += len(rows)
            counts[table.name] = count

    if destination_engine.dialect.name == "postgresql":
        with destination_engine.begin() as connection:
            inspector = inspect(connection)
            for table in tables:
                primary_key = inspector.get_pk_constraint(table.name)["constrained_columns"]
                if len(primary_key) != 1:
                    continue
                column_name = primary_key[0]
                sequence = connection.execute(
                    text("SELECT pg_get_serial_sequence(:table_name, :column_name)"),
                    {"table_name": table.name, "column_name": column_name},
                ).scalar_one_or_none()
                if not sequence:
                    continue
                maximum = connection.execute(
                    select(func.max(table.c[column_name]))
                ).scalar_one()
                connection.execute(
                    text("SELECT setval(CAST(:sequence_name AS regclass), :value, :called)"),
                    {
                        "sequence_name": sequence,
                        "value": maximum or 1,
                        "called": maximum is not None,
                    },
                )
    return counts


def main() -> None:
    if target_engine.dialect.name != "postgresql":
        raise RuntimeError("DATABASE_URL must point to the hosted PostgreSQL database")
    if settings.MEDIA_STORAGE_BACKEND != "r2":
        raise RuntimeError("Set MEDIA_STORAGE_BACKEND=r2 and provide the R2 credentials")

    source_db = Path(os.getenv("MIGRATION_SOURCE_DB", str(BASE_DIR / "gallery.db"))).resolve()
    source_storage = Path(
        os.getenv("MIGRATION_SOURCE_STORAGE_DIR", str(settings.STORAGE_DIR))
    ).resolve()
    if not source_db.is_file():
        raise FileNotFoundError(f"Local SQLite database not found: {source_db}")

    source_engine = create_engine(URL.create("sqlite", database=str(source_db)))
    try:
        Base.metadata.create_all(source_engine)
        ensure_columns(source_engine)
        Base.metadata.create_all(target_engine)
        ensure_columns(target_engine)

        _ensure_empty_target(target_engine)

        file_count, total_bytes = _copy_media(source_storage)
        row_counts = _copy_records(source_engine)
        log.info(
            "Migration complete: copied %s records across %s tables and %s media files (%.1f MB).",
            sum(row_counts.values()),
            sum(count > 0 for count in row_counts.values()),
            file_count,
            total_bytes / (1024 * 1024),
        )
    finally:
        source_engine.dispose()


if __name__ == "__main__":
    main()
