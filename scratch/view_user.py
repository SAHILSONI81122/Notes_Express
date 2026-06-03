import asyncio
from sqlalchemy.future import select
from backend.database.database import AsyncSessionLocal
from backend.models.models import User, NoteCompletion, Attempt, UserChestClaim, UserBooster

async def main():
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(User).where(User.id == 4))
        user = res.scalars().first()
        if not user:
            print("User ID 4 not found!")
            return
        
        print(f"User ID 4:")
        print(f"  Name: {user.name}")
        print(f"  Email: {user.email}")
        print(f"  Coins in DB: {user.coins}")
        print(f"  XP: {user.xp}")
        
        # Completed notes
        note_res = await db.execute(select(NoteCompletion).where(NoteCompletion.user_id == 4, NoteCompletion.is_completed == True))
        notes = note_res.scalars().all()
        print(f"  Completed Notes: {len(notes)}")
        
        # Completed DPPs
        dpp_res = await db.execute(select(Attempt).where(Attempt.user_id == 4, Attempt.completed == True))
        dpps = dpp_res.scalars().all()
        print(f"  Completed DPPs: {len(dpps)}")

        # Spent on Boosters
        booster_res = await db.execute(select(UserBooster).where(UserBooster.user_id == 4))
        boosters = booster_res.scalars().all()
        total_spent = sum(b.coin_cost for b in boosters)
        print(f"  Total Boosters bought: {len(boosters)} (Spent: {total_spent})")
        
        # Chest claims
        chest_res = await db.execute(select(UserChestClaim).where(UserChestClaim.user_id == 4))
        chests = chest_res.scalars().all()
        total_chest_coins = sum(c.coins_rewarded for c in chests)
        print(f"  Total Chest Claims: {len(chests)} (Earned: {total_chest_coins})")

if __name__ == "__main__":
    asyncio.run(main())
