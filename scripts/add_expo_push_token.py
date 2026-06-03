import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
import sys

DATABASE_URL = "postgresql+asyncpg://postgres:postgres@localhost/notesexpress"

async def migrate():
    print(f"Connecting to {DATABASE_URL}")
    engine = create_async_engine(DATABASE_URL)
    async with engine.begin() as conn:
        try:
            print("Adding expo_push_token column to users table...")
            await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS expo_push_token VARCHAR;"))
            print("Successfully added column 'expo_push_token' to users table.")
        except Exception as e:
            print(f"Migration error: {e}")
                
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(migrate())
