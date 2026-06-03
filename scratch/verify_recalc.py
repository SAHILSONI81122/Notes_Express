import asyncio
import sys
sys.path.append("/Users/sahil/Desktop/notes_express 2")

from backend.database.database import AsyncSessionLocal
from backend.routes.tracking import recalculate_user_xp_and_streak
from backend.models.models import User

async def main():
    async with AsyncSessionLocal() as db:
        user = await db.get(User, 4)
        print(f"Before Recalculation -> XP: {user.xp}, Level: {user.level}, Streak: {user.streak_count}")
        
        await recalculate_user_xp_and_streak(4, db)
        
        # Reload user
        await db.refresh(user)
        print(f"After Recalculation -> XP: {user.xp}, Level: {user.level}, Streak: {user.streak_count}")

if __name__ == "__main__":
    asyncio.run(main())
