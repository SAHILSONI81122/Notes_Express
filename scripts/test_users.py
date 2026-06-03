import asyncio
from backend.database.database import AsyncSessionLocal
from backend.models.models import User, RoleEnum
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

async def main():
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(User).options(selectinload(User.all_batches)).where(User.role == RoleEnum.admin))
        admins = res.scalars().all()
        for a in admins:
            print(f"Admin: {a.id} ({a.name}) | batch_id: {a.batch_id} | all_batches: {[b.id for b in a.all_batches]}")

asyncio.run(main())
