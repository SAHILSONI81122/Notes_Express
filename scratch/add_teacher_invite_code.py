import asyncio
import random
import string
from sqlalchemy import text
from backend.database.database import AsyncSessionLocal

def generate_code():
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))

async def update_db():
    async with AsyncSessionLocal() as db:
        try:
            await db.execute(text("ALTER TABLE batches ADD COLUMN teacher_invite_code VARCHAR UNIQUE;"))
            print("Added teacher_invite_code column.")
        except Exception as e:
            print(f"Column teacher_invite_code might already exist: {e}")
        
        try:
            await db.execute(text("ALTER TABLE batches ADD COLUMN teacher_invite_code_expires_at TIMESTAMP;"))
            print("Added teacher_invite_code_expires_at column.")
        except Exception as e:
            print(f"Column teacher_invite_code_expires_at might already exist: {e}")

        await db.commit()

        # Populate existing batches
        result = await db.execute(text("SELECT id FROM batches WHERE teacher_invite_code IS NULL;"))
        batch_ids = result.scalars().all()
        
        from datetime import datetime, timedelta
        for bid in batch_ids:
            new_code = generate_code()
            expiry = datetime.utcnow() + timedelta(days=1)
            await db.execute(
                text("UPDATE batches SET teacher_invite_code = :code, teacher_invite_code_expires_at = :expiry WHERE id = :id"),
                {"code": new_code, "expiry": expiry, "id": bid}
            )
            print(f"Updated batch {bid} with teacher code {new_code}")
        
        await db.commit()
        print("Done!")

if __name__ == "__main__":
    asyncio.run(update_db())
