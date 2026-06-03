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
            print("Adding streak_freezers_owned column to users table...")
            await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS streak_freezers_owned INTEGER DEFAULT 0 NOT NULL;"))
            print("Successfully added column 'streak_freezers_owned' to users table.")

            print("Creating streak_freezes table...")
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS streak_freezes (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    freeze_date DATE NOT NULL,
                    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );
            """))
            print("Successfully created 'streak_freezes' table.")

        except Exception as e:
            print(f"Migration error: {e}")
                
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(migrate())
