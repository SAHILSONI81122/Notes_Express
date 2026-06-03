import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
import sys

# Try connecting to the PostgreSQL database
DATABASE_URL = "postgresql+asyncpg://postgres:postgres@localhost/notesexpress"

async def migrate():
    print(f"Connecting to {DATABASE_URL}")
    engine = create_async_engine(DATABASE_URL)
    async with engine.begin() as conn:
        try:
            print("Adding audio_url column to messages table...")
            # SQLite does not support IF NOT EXISTS in ALTER TABLE ADD COLUMN easily for all versions.
            # We'll just try to add it and catch the error if it already exists.
            await conn.execute(text("ALTER TABLE messages ADD COLUMN audio_url VARCHAR;"))
            print("Successfully added column 'audio_url' to messages table.")
        except Exception as e:
            if "duplicate column name" in str(e).lower():
                print("Column 'audio_url' already exists.")
            else:
                print(f"Migration error: {e}")
                
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(migrate())
