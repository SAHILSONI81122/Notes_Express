import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

DATABASE_URL = "postgresql+asyncpg://postgres:postgres@localhost/notesexpress"

async def migrate():
    engine = create_async_engine(DATABASE_URL)
    async with engine.begin() as conn:
        await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS streak_freezers_purchased INTEGER DEFAULT 0 NOT NULL;"))
    await engine.dispose()
    print("Done")

if __name__ == "__main__":
    asyncio.run(migrate())
