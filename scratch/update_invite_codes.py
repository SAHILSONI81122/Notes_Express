import asyncio
import random
import string
from sqlalchemy import text
from backend.database.database import AsyncSessionLocal
from backend.models.models import Batch

def generate_code():
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))

async def update_db():
    async with AsyncSessionLocal() as db:
        # Try to add the column if it doesn't exist
        try:
            await db.execute(text("ALTER TABLE batches ADD COLUMN invite_code VARCHAR UNIQUE;"))
            await db.commit()
            print("Added invite_code column.")
        except Exception as e:
            print(f"Column might already exist: {e}")
            await db.rollback()

        # Populate existing batches
        result = await db.execute(text("SELECT id FROM batches WHERE invite_code IS NULL;"))
        batch_ids = result.scalars().all()
        
        for bid in batch_ids:
            new_code = generate_code()
            await db.execute(text("UPDATE batches SET invite_code = :code WHERE id = :id"), {"code": new_code, "id": bid})
            print(f"Updated batch {bid} with code {new_code}")
        
        await db.commit()
        print("Done!")

if __name__ == "__main__":
    asyncio.run(update_db())
