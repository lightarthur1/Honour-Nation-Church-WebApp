from pathlib import Path

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BASE_DIR / ".env", extra="ignore")

    ENV: str = "development"
    TRUST_PROXY: bool = False
    SECRET_KEY: str = "dev-only-change-me"
    ACCESS_TOKEN_MINUTES: int = 720
    ADMIN_TOKEN_MINUTES: int = 60
    EDITOR_TOKEN_MINUTES: int = 480
    USER_TOKEN_MINUTES: int = 720
    MFA_TOKEN_MINUTES: int = 5
    DATABASE_URL: str = f"sqlite:///{BASE_DIR / 'gallery.db'}"
    STORAGE_DIR: Path = BASE_DIR / "storage"
    MEDIA_STORAGE_BACKEND: str = "local"
    R2_ENDPOINT_URL: str = ""
    R2_BUCKET_NAME: str = ""
    R2_ACCESS_KEY_ID: str = ""
    R2_SECRET_ACCESS_KEY: str = ""
    CORS_ORIGINS: str = "http://localhost:5173"
    REQUIRE_ADMIN_2FA: bool = False

    BOOTSTRAP_ADMIN_EMAIL: str = Field(
        default="admin@churchgallery.org",
        validation_alias=AliasChoices("BOOTSTRAP_ADMIN_EMAIL", "FIRST_ADMIN_EMAIL"),
    )
    BOOTSTRAP_ADMIN_PASSWORD: str = Field(
        default="ChangeMe123!",
        validation_alias=AliasChoices("BOOTSTRAP_ADMIN_PASSWORD", "FIRST_ADMIN_PASSWORD"),
    )

    MAX_UPLOAD_MB: int = 7168
    MAX_UNCOMPRESSED_MB: int = 7168
    MAX_FILES_PER_ZIP: int = 5000

    VISUAL_SEARCH_MODEL: str = "openai/clip-vit-base-patch32"

    DRIVE_ENABLED: bool = False
    # "oauth" = upload as a church Google account (works with free Gmail)
    # "service_account" = Shared Drive on Google Workspace
    DRIVE_AUTH: str = "oauth"
    GOOGLE_OAUTH_TOKEN_FILE: str = "credentials/drive-token.json"
    GOOGLE_DRIVE_FOLDER_NAME: str = "Church Media Gallery"
    GOOGLE_SERVICE_ACCOUNT_FILE: str = "credentials/service-account.json"
    GOOGLE_DRIVE_FOLDER_ID: str = ""  # service_account mode only

    PREVIEW_MAX_BYTES: int = 300 * 1024
    PREVIEW_MAX_EDGE: int = 1280

    @property
    def raw_dir(self) -> Path:
        return self.STORAGE_DIR / "raw"

    @property
    def edited_tmp_dir(self) -> Path:
        return self.STORAGE_DIR / "edited_tmp"

    @property
    def edited_images_dir(self) -> Path:
        return self.STORAGE_DIR / "edited_images"

    @property
    def previews_dir(self) -> Path:
        return self.STORAGE_DIR / "previews"

    @property
    def event_posters_dir(self) -> Path:
        return self.STORAGE_DIR / "event_posters"

    @property
    def documents_dir(self) -> Path:
        return self.STORAGE_DIR / "documents"

    @property
    def model_cache_dir(self) -> Path:
        return self.STORAGE_DIR / "models"

    @property
    def cors_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


settings = Settings()
if settings.MEDIA_STORAGE_BACKEND not in {"local", "r2"}:
    raise ValueError("MEDIA_STORAGE_BACKEND must be 'local' or 'r2'")
if settings.MEDIA_STORAGE_BACKEND == "r2":
    missing_r2_settings = [
        name for name in (
            "R2_ENDPOINT_URL",
            "R2_BUCKET_NAME",
            "R2_ACCESS_KEY_ID",
            "R2_SECRET_ACCESS_KEY",
        )
        if not getattr(settings, name)
    ]
    if missing_r2_settings:
        raise ValueError(
            "R2 storage is enabled but these settings are missing: "
            + ", ".join(missing_r2_settings)
        )
for d in (settings.raw_dir, settings.edited_tmp_dir, settings.edited_images_dir, settings.previews_dir,
          settings.event_posters_dir, settings.documents_dir):
    d.mkdir(parents=True, exist_ok=True)
