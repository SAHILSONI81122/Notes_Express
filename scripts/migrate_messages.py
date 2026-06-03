"""
Migration script to add the 'messages' table for the doubt/messaging feature.
Run this once to create the table in your existing database.
"""
import asyncio
from sqlalchemy import text
from backend.database.database import engine

async def migrate():
    async with engine.begin() as conn:
        # Check if messages table already exists
        result = await conn.execute(text(
            "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'messages')"
        ))
        exists = result.scalar()
        
        if exists:
            print("✅ 'messages' table already exists. Skipping migration.")
            return
        
        await conn.execute(text("""
            CREATE TABLE messages (
                id SERIAL PRIMARY KEY,
                sender_id INTEGER NOT NULL REFERENCES users(id),
                receiver_id INTEGER NOT NULL REFERENCES users(id),
                batch_id INTEGER NOT NULL REFERENCES batches(id),
                content TEXT NOT NULL,
                subject VARCHAR,
                is_read BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT NOW()
            )
        """))
        
        # Create indexes for fast lookups
        await conn.execute(text(
            "CREATE INDEX ix_messages_sender_id ON messages(sender_id)"
        ))
        await conn.execute(text(
            "CREATE INDEX ix_messages_receiver_id ON messages(receiver_id)"
        ))
        await conn.execute(text(
            "CREATE INDEX ix_messages_batch_id ON messages(batch_id)"
        ))
        await conn.execute(text(
            "CREATE INDEX ix_messages_created_at ON messages(created_at DESC)"
        ))
        
        print("✅ 'messages' table created successfully!")
        print("   - Indexes added for sender_id, receiver_id, batch_id, and created_at")

if __name__ == "__main__":
    asyncio.run(migrate())
