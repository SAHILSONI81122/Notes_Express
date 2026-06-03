import asyncio
import sys
sys.path.append("/Users/sahil/Desktop/notes_express 2")

from backend.database.database import AsyncSessionLocal
from backend.models.models import User, NoteCompletion, Attempt
from sqlalchemy import delete

async def main():
    async with AsyncSessionLocal() as db:
        user = await db.get(User, 4)
        if not user:
            print("User Michael not found")
            return
            
        print(f"Before reset -> Name: {user.name}, XP: {user.xp}, Level: {user.level}, Streak: {user.streak_count}")
        
        # Delete completions and attempts
        await db.execute(delete(NoteCompletion).where(NoteCompletion.user_id == 4))
        await db.execute(delete(Attempt).where(Attempt.user_id == 4))
        
        # Reset user stats
        user.xp = 0
        user.level = 1
        user.streak_count = 0
        user.last_streak_date = None
        db.add(user)
        
        await db.commit()
        await db.refresh(user)
        print(f"After reset -> Name: {user.name}, XP: {user.xp}, Level: {user.level}, Streak: {user.streak_count}")

if __name__ == "__main__":
    asyncio.run(main())
