from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import settings

# ── Async engine (FastAPI v2 routes) ─────────────────────────────────────────
engine = create_async_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
    echo=settings.DEBUG,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """Shared declarative base for all ORM models."""
    pass


# ── Sync engine (admin / charge routers) ─────────────────────────────────────
def _sync_database_url(url: str) -> str:
    return url.replace("+asyncpg", "+psycopg2")


sync_engine = create_engine(
    _sync_database_url(settings.DATABASE_URL),
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
    echo=settings.DEBUG,
)

SyncSessionLocal = sessionmaker(bind=sync_engine, autocommit=False, autoflush=False)


def get_sync_db():
    """Sync DB session for admin and charge controllers."""
    db = SyncSessionLocal()
    try:
        yield db
    finally:
        db.close()
