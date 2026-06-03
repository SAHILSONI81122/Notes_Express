import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

DATABASE_URL = "postgresql+asyncpg://postgres:postgres@localhost/notesexpress"

async def migrate():
    engine = create_async_engine(DATABASE_URL)
    async with engine.begin() as conn:
        try:
            await conn.execute(text("ALTER TABLE users ADD COLUMN current_action VARCHAR;"))
            print("Successfully added column current_action to users table")
        except Exception as e:
            print(f"Error or already exists: {e}")
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(migrate())
