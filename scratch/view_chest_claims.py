import asyncio
from datetime import datetime
from sqlalchemy.future import select
from backend.database.database import AsyncSessionLocal
from backend.models.models import UserChestClaim, User

async def main():
    print(f"Current local time: {datetime.now()}")
    print(f"Current UTC time (utcnow): {datetime.utcnow()}")
    
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(UserChestClaim).order_by(UserChestClaim.claimed_at.desc()))
        claims = res.scalars().all()
        print(f"\nFound {len(claims)} chest claims in the database:")
        for c in claims:
            print(f"- Claim ID: {c.id}")
            print(f"  User ID: {c.user_id}")
            print(f"  Chest Type: {c.chest_type}")
            print(f"  Coins Rewarded: {c.coins_rewarded}")
            print(f"  Claimed At: {c.claimed_at}")
            print(f"  Type of claimed_at: {type(c.claimed_at)}")

if __name__ == "__main__":
    asyncio.run(main())
