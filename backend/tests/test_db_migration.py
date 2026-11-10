from sqlalchemy import create_engine, inspect, text

from app.core.db_migration import ensure_columns


def test_ensure_columns_upgrades_legacy_schema_idempotently():
    engine = create_engine("sqlite://")
    with engine.begin() as connection:
        connection.execute(text("CREATE TABLE users (id INTEGER PRIMARY KEY)"))
        connection.execute(text("CREATE TABLE events (id INTEGER PRIMARY KEY)"))
        connection.execute(text("CREATE TABLE preview_images (id INTEGER PRIMARY KEY)"))
        connection.execute(text("CREATE TABLE edited_archives (id INTEGER PRIMARY KEY)"))
        connection.execute(text("CREATE TABLE program_events (id INTEGER PRIMARY KEY)"))

    ensure_columns(engine)
    ensure_columns(engine)

    inspector = inspect(engine)
    user_columns = {column["name"] for column in inspector.get_columns("users")}
    preview_columns = {
        column["name"] for column in inspector.get_columns("preview_images")
    }
    archive_columns = {
        column["name"] for column in inspector.get_columns("edited_archives")
    }
    program_event_columns = {
        column["name"] for column in inspector.get_columns("program_events")
    }

    assert {"totp_secret", "totp_enabled"} <= user_columns
    assert "totp_secret" not in preview_columns
    assert "embedding" in preview_columns
    assert "storage_key" in archive_columns
    assert "gallery_event_id" in program_event_columns
    assert "ix_program_events_gallery_event_id" in {
        index["name"] for index in inspector.get_indexes("program_events")
    }

    engine.dispose()
