from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # App
    APP_NAME: str = "Kimit DataPath Analyzer"
    APP_VERSION: str = "2.0.0"
    DEBUG: bool = False

    # Database
    DATABASE_URL: str  # e.g. postgresql+asyncpg://user:pass@db/kimit

    # Redis / Celery
    REDIS_URL: str = "redis://redis:6379/0"
    CELERY_BROKER_URL: str = "redis://redis:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://redis:6379/1"

    # Groq AI
    GROQ_API_KEY: str = ""

    # Fernet encryption key (generate once: Fernet.generate_key())
    FERNET_KEY: str

    # Firebase Admin SDK (path to service account JSON)
    FIREBASE_CREDENTIALS_PATH: str = "firebase-adminsdk.json"

    # CORS
    ALLOWED_ORIGINS: list[str] = ["http://localhost:5173"]

    # Rate limiting
    RATE_LIMIT_DEFAULT: str = "60/minute"
    RATE_LIMIT_AI: str = "10/minute"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()  # type: ignore[call-arg]
