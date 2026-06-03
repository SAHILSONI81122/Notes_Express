import asyncio
from sqlalchemy.future import select
from backend.database.database import AsyncSessionLocal
from backend.models.models import User, Batch, RoleEnum

async def promote_creators():
    async with AsyncSessionLocal() as db:
        # Find all users who are teacher_id in any batch
        result = await db.execute(select(Batch.teacher_id))
        teacher_ids = result.scalars().all()
        
        if not teacher_ids:
            print("No batches found.")
            return

        # Update these users to ADMIN
        result = await db.execute(select(User).where(User.id.in_(teacher_ids)))
        users = result.scalars().all()
        
        for user in users:
            user.role = RoleEnum.admin
            print(f"Promoting {user.email} to ADMIN")
        
        await db.commit()
        print("Success!")

if __name__ == "__main__":
    asyncio.run(promote_creators())
