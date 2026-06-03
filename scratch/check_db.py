import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from backend.database.database import DATABASE_URL

async def check_db():
    try:
        engine = create_async_engine(DATABASE_URL)
        async with engine.connect() as conn:
            print("Successfully connected to the database!")
    except Exception as e:
        print(f"Failed to connect to the database: {e}")

if __name__ == "__main__":
    asyncio.run(check_db())
