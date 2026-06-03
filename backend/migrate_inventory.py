import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

async def migrate():
    engine = create_async_engine('postgresql+asyncpg://postgres:postgres@localhost/notesexpress')
    async with engine.begin() as conn:
        try:
            await conn.execute(text("ALTER TABLE users ADD COLUMN inventory_boosters JSON DEFAULT '[]' NOT NULL;"))
            print("Successfully added inventory_boosters column!")
        except Exception as e:
            print(f"Error adding column (maybe it already exists?): {e}")
            
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(migrate())
