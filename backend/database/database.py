import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import declarative_base, sessionmaker
from dotenv import load_dotenv

load_dotenv(override=True)

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@localhost/notesexpress"  # local dev fallback
)

# echo=True logs every SQL query — disable in production
IS_DEV = os.environ.get("ENV", "development") == "development"

# Disable verbose SQL logging to speed up terminal I/O
engine = create_async_engine(
    DATABASE_URL, 
    echo=False,
    pool_size=20,
    max_overflow=10,
    pool_recycle=1800,
    pool_pre_ping=True,
    connect_args={"statement_cache_size": 0, "prepared_statement_cache_size": 0}
)

AsyncSessionLocal = sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

Base = declarative_base()

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
