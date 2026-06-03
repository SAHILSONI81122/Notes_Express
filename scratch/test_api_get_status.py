import asyncio
from sqlalchemy.future import select
from backend.database.database import AsyncSessionLocal
from backend.models.models import User
from backend.routes.tracking import get_chests_status
from backend.routes.auth import get_me

async def main():
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(User).where(User.id == 4))
        user = res.scalars().first()
        if not user:
            print("User ID 4 not found!")
            return
        
        print("Testing get_chests_status:")
        try:
            status = await get_chests_status(db=db, current_user=user)
            print(f"Weekly Activity Count: {status.weekly_activity_count}")
            for c in status.chests:
                print(f"  Chest: Type={c.chest_type}, Status={c.status}, Progress={c.progress}/{c.target}")
        except Exception as e:
            print(f"Error calling get_chests_status: {e}")
            
        print("\nTesting get_me:")
        try:
            me = await get_me(db=db, current_user=user)
            print(f"User: Name={me.name}, Email={me.email}, Coins={me.coins}, XP={me.xp}")
        except Exception as e:
            print(f"Error calling get_me: {e}")

if __name__ == "__main__":
    asyncio.run(main())
