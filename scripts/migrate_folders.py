import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

DATABASE_URL = "postgresql+asyncpg://postgres:postgres@localhost/notesexpress"

async def migrate():
    engine = create_async_engine(DATABASE_URL)
    async with engine.begin() as conn:
        try:
            await conn.execute(text("ALTER TABLE folders ADD COLUMN parent_id INTEGER REFERENCES folders(id);"))
            print("Successfully added column parent_id to folders table")
        except Exception as e:
            print(f"Error or already exists: {e}")
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(migrate())
