import asyncio
from backend.database.database import AsyncSessionLocal
from backend.models.models import User, user_batches
from sqlalchemy.future import select

async def main():
    async with AsyncSessionLocal() as db:
        query = select(User).where(
            (User.batch_id == 9) | (User.id.in_(select(user_batches.c.user_id).where(user_batches.c.batch_id == 9)))
        )
        res = await db.execute(query)
        members = res.scalars().all()
        print(f"Batch 9 members count: {len(members)}")

asyncio.run(main())
