+import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, selectinload
from sqlalchemy import select
from backend.models.models import User
from backend.schemas.schemas import UserOut

async def test():
    engine = create_async_engine('postgresql+asyncpg://postgres:postgres@localhost/notesexpress')
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        stmt = select(User).options(
            selectinload(User.batch),
            selectinload(User.all_batches),
            selectinload(User.class_groups),
            selectinload(User.institute)
        ).limit(1)
        result = await session.execute(stmt)
        user = result.scalars().first()
        
        if user:
            print("User found:", user.email)
            try:
                user_out = UserOut.from_orm(user)
                print("Serialization successful!")
                print(user_out.dict())
            except Exception as e:
                print("Serialization error:", e)
        else:
            print("No users found.")

if __name__ == "__main__":
    asyncio.run(test())
