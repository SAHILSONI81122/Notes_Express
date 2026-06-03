import asyncio
from sqlalchemy import text
from backend.database.database import engine

async def migrate():
    async with engine.begin() as conn:
        print("Starting coins migration...")
        
        # Check if columns exist first to avoid errors
        await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS coins INTEGER DEFAULT 0"))
        
        print("Migration completed successfully!")

if __name__ == "__main__":
    asyncio.run(migrate())
