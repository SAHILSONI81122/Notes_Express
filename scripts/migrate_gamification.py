import asyncio
from sqlalchemy import text
from backend.database.database import engine

async def migrate():
    async with engine.begin() as conn:
        print("Starting gamification migration...")
        
        # Check if columns exist first to avoid errors
        await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS xp INTEGER DEFAULT 0"))
        await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1"))
        await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS streak_count INTEGER DEFAULT 0"))
        await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_streak_date TIMESTAMP WITHOUT TIME ZONE"))
        
        print("Migration completed successfully!")

if __name__ == "__main__":
    asyncio.run(migrate())
