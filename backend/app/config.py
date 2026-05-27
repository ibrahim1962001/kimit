from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # App
    APP_NAME: str = "Kimit DataPath Analyzer"
    APP_VERSION: str = "2.0.0"
    DEBUG: bool = False

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:1234@localhost:5432/kimit_db"

    # Redis / Celery
    REDIS_URL: str = "redis://redis:6379/0"
    CELERY_BROKER_URL: str = "redis://redis:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://redis:6379/1"

    # Groq AI
    GROQ_API_KEY: str = ""

    # Fernet encryption key (generate once: Fernet.generate_key())
    FERNET_KEY: str = "vE7f-JzR1m_3k8Lp9zW2xY4vQ6sT8uN0mK9iH7gD5eA="

    # Firebase Admin SDK (path to service account JSON)
    FIREBASE_CREDENTIALS_PATH: str = "firebase-adminsdk.json"

    # Credits
    WELCOME_CREDITS: float = 10.0
    CREDIT_COST_UPLOAD: float = 1.0
    CREDIT_COST_CLEAN: float = 0.5
    CREDIT_COST_AI_SUMMARY: float = 2.0
    CREDIT_COST_AI_CHAT: float = 0.5

    # CORS
    ALLOWED_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
    ]

    # Rate limiting
    RATE_LIMIT_DEFAULT: str = "60/minute"
    RATE_LIMIT_AI: str = "10/minute"

    # MinIO / S3
    MINIO_ENDPOINT: str = "minio:9000"
    MINIO_ACCESS_KEY: str = "kimit_admin"
    MINIO_SECRET_KEY: str = "kimit_storage_secret"
    MINIO_SECURE: bool = False
    MINIO_BUCKET_NAME: str = "datasets"

    # Power BI (Service Principal)
    POWERBI_ENABLED: bool = False
    POWERBI_TENANT_ID: str = ""
    POWERBI_CLIENT_ID: str = ""
    POWERBI_CLIENT_SECRET: str = ""
    POWERBI_WORKSPACE_ID: str = ""
    POWERBI_REPORT_TEMPLATE_ID: str = ""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()  # type: ignore[call-arg]
