import asyncio
from sqlalchemy import text
from backend.database.database import engine

async def migrate():
    async with engine.begin() as conn:
        print("Starting XP Booster database migration...")
        
        # 1. Add columns to users table
        await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS xp_booster_expiry TIMESTAMP WITHOUT TIME ZONE"))
        await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS xp_booster_multiplier DOUBLE PRECISION DEFAULT 1.0"))
        
        # 2. Create user_boosters table
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS user_boosters (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                start_time TIMESTAMP WITHOUT TIME ZONE NOT NULL,
                end_time TIMESTAMP WITHOUT TIME ZONE NOT NULL,
                multiplier DOUBLE PRECISION NOT NULL DEFAULT 2.0,
                coin_cost INTEGER NOT NULL DEFAULT 0
            )
        """))
        
        # Add column if table already exists
        await conn.execute(text("ALTER TABLE user_boosters ADD COLUMN IF NOT EXISTS coin_cost INTEGER NOT NULL DEFAULT 0"))
        
        # 3. Create index on user_boosters
        await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_user_boosters_id ON user_boosters (id)"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_user_boosters_user_id ON user_boosters (user_id)"))
        
        print("Migration completed successfully!")

if __name__ == "__main__":
    asyncio.run(migrate())
