from sqlalchemy import text

from app.db.session import SessionLocal


def ensure_columns() -> None:
    with SessionLocal() as db:
        tables = db.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';")).fetchall()
        for (table_name,) in tables:
            cols = {row[1] for row in db.execute(text(f"PRAGMA table_info('{table_name}')")).fetchall()}
            if 'totp_secret' not in cols:
                db.execute(text(f"ALTER TABLE {table_name} ADD COLUMN totp_secret TEXT"))
            if 'totp_enabled' not in cols:
                db.execute(text(f"ALTER TABLE {table_name} ADD COLUMN totp_enabled BOOLEAN NOT NULL DEFAULT 0"))
            if table_name == "preview_images" and "embedding" not in cols:
                db.execute(text("ALTER TABLE preview_images ADD COLUMN embedding TEXT"))
            if table_name == "program_events" and "gallery_event_id" not in cols:
                db.execute(text(
                    "ALTER TABLE program_events ADD COLUMN gallery_event_id INTEGER "
                    "REFERENCES events(id) ON DELETE SET NULL"
                ))
        db.commit()
