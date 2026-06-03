import asyncio
from sqlalchemy import text
from backend.database.database import engine

async def migrate():
    async with engine.begin() as conn:
        print("Starting Chest Reward System database migration...")
        
        # Create user_chest_claims table
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS user_chest_claims (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                chest_type VARCHAR NOT NULL,
                coins_rewarded INTEGER NOT NULL DEFAULT 0,
                booster_rewarded_type VARCHAR,
                claimed_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT (now() at time zone 'utc')
            )
        """))
        
        # Create indexes
        await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_user_chest_claims_id ON user_chest_claims (id)"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_user_chest_claims_user_id ON user_chest_claims (user_id)"))
        
        print("Migration completed successfully!")

if __name__ == "__main__":
    asyncio.run(migrate())
