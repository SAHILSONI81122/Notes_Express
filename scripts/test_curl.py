import asyncio
import warnings
warnings.filterwarnings("ignore")
from backend.database.database import AsyncSessionLocal
from backend.models.models import User, RoleEnum
from sqlalchemy.future import select

async def main():
    async with AsyncSessionLocal() as db:
        user_res = await db.execute(select(User).where(User.role == RoleEnum.admin).limit(1))
        admin = user_res.scalars().first()
        if admin:
            from backend.routes.auth import create_access_token
            from datetime import timedelta
            token = create_access_token({"sub": admin.email, "role": admin.role.value, "id": admin.id}, timedelta(minutes=60))
            print(f"{token},{admin.batch_id}")

asyncio.run(main())
