from sqlalchemy import create_engine
from sqlalchemy.engine import URL
from sqlalchemy.orm import Session

from app.db import models  # noqa: F401
from app.db.models import Role, User
from app.db.session import Base
from scripts.migrate_local_data import _copy_records


def test_copy_records_preserves_ids_and_enums(tmp_path):
    source_engine = create_engine(URL.create("sqlite", database=str(tmp_path / "source.db")))
    destination_engine = create_engine(URL.create("sqlite", database=str(tmp_path / "destination.db")))
    Base.metadata.create_all(source_engine)
    Base.metadata.create_all(destination_engine)

    with Session(source_engine) as db:
        db.add(User(
            id=42,
            email="admin@example.org",
            full_name="Admin",
            password_hash="hashed",
            role=Role.admin,
        ))
        db.commit()

    counts = _copy_records(source_engine, destination_engine)

    with Session(destination_engine) as db:
        copied = db.get(User, 42)
        assert copied is not None
        assert copied.email == "admin@example.org"
        assert copied.role == Role.admin
    assert counts["users"] == 1

    source_engine.dispose()
    destination_engine.dispose()
