import os
import sys
import tempfile
from pathlib import Path

# Configure the app BEFORE it is imported: settings are read once at import time.
_TMP = Path(tempfile.mkdtemp(prefix="gallery-tests-"))
os.environ.update(
    DEBUG="true",
    SECRET_KEY="test-secret-key-test-secret-key-1234567890",
    DATABASE_URL=f"sqlite:///{(_TMP / 'test.db').as_posix()}",
    STORAGE_DIR=str(_TMP / "storage"),
    BOOTSTRAP_ADMIN_EMAIL="admin@churchgallery.org",
    BOOTSTRAP_ADMIN_PASSWORD="ChangeMe123!",
    DRIVE_ENABLED="false",
)
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c
