from sqlalchemy import Engine, inspect, text


def ensure_columns(engine: Engine) -> None:
    with engine.begin() as connection:
        inspector = inspect(connection)
        tables = set(inspector.get_table_names())

        migrations = {
            "users": {
                "totp_secret": "VARCHAR(255)",
                "totp_enabled": (
                    "BOOLEAN NOT NULL DEFAULT FALSE"
                    if connection.dialect.name == "postgresql"
                    else "BOOLEAN NOT NULL DEFAULT 0"
                ),
            },
            "preview_images": {"embedding": "TEXT"},
            "edited_archives": {"storage_key": "VARCHAR(500)"},
            "program_events": {
                "gallery_event_id": (
                    "INTEGER REFERENCES events(id) ON DELETE SET NULL"
                ),
            },
        }

        for table_name, columns in migrations.items():
            if table_name not in tables:
                continue
            existing_columns = {
                column["name"] for column in inspector.get_columns(table_name)
            }
            for column_name, definition in columns.items():
                if column_name not in existing_columns:
                    connection.execute(text(
                        f"ALTER TABLE {table_name} ADD COLUMN {column_name} {definition}"
                    ))

        if "program_events" in tables:
            connection.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_program_events_gallery_event_id "
                "ON program_events (gallery_event_id)"
            ))
