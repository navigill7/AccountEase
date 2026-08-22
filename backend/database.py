"""Database session management using SQLAlchemy 2 async with asyncpg."""
from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# Safety: allow this module to be imported without server.py loading .env first
load_dotenv(Path(__file__).parent / ".env")


def _build_async_url() -> str:
    raw = os.environ["DATABASE_URL"]
    # Accept either postgres:// or postgresql:// and convert to asyncpg driver
    if raw.startswith("postgres://"):
        raw = "postgresql://" + raw[len("postgres://"):]
    if raw.startswith("postgresql://") and "+asyncpg" not in raw:
        raw = "postgresql+asyncpg://" + raw[len("postgresql://"):]
    return raw


DATABASE_URL = _build_async_url()

# Supabase pooler uses PgBouncer in transaction mode - disable prepared statement cache.
engine = create_async_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=5,
    connect_args={"statement_cache_size": 0, "prepared_statement_cache_size": 0},
)

AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


async def get_session() -> AsyncSession:  # type: ignore[misc]
    async with AsyncSessionLocal() as session:
        yield session
