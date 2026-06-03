import asyncio
from backend.database.database import AsyncSessionLocal
from backend.models.models import User, user_batches, Batch
from sqlalchemy.future import select

async def main():
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(Batch))
        batches = res.scalars().all()
        for b in batches:
            query = select(User).where(
                (User.batch_id == b.id) | (User.id.in_(select(user_batches.c.user_id).where(user_batches.c.batch_id == b.id)))
            )
            users_res = await db.execute(query)
            print(f"Batch {b.id} ({b.name}) has {len(users_res.scalars().all())} members")

asyncio.run(main())
