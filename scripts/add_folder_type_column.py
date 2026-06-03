import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

DATABASE_URL = "postgresql+asyncpg://postgres:postgres@localhost/notesexpress"

async def migrate():
    engine = create_async_engine(DATABASE_URL)
    async with engine.begin() as conn:
        try:
            # 1. Add folder_type column
            await conn.execute(text("ALTER TABLE folders ADD COLUMN IF NOT EXISTS folder_type VARCHAR(50) DEFAULT 'notes';"))
            print("Successfully added column 'folder_type' to folders table.")
            
            # 2. Update folder_type to 'dpp' for folders containing DPPs
            res = await conn.execute(text(
                "UPDATE folders SET folder_type = 'dpp' WHERE id IN (SELECT DISTINCT folder_id FROM dpps WHERE folder_id IS NOT NULL);"
            ))
            print(f"Successfully migrated existing DPP folders.")
            
        except Exception as e:
            print(f"Migration error: {e}")
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(migrate())
