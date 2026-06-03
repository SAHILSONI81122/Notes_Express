import asyncio
from sqlalchemy.future import select
from backend.database.database import AsyncSessionLocal
from backend.models.models import User

async def main():
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(User))
        users = res.scalars().all()
        print(f"Total users: {len(users)}")
        for u in users:
            print(f"- ID: {u.id}, Name: {u.name}, Email: {u.email}, Coins: {u.coins}, Role: {u.role}")

if __name__ == "__main__":
    asyncio.run(main())
