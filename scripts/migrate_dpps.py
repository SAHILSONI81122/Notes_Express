import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

DATABASE_URL = "postgresql+asyncpg://postgres:postgres@localhost/notesexpress"

async def migrate():
    engine = create_async_engine(DATABASE_URL)
    
    # Run each migration in a separate transaction
    for command in [
        "ALTER TABLE dpps ADD COLUMN file_url VARCHAR;",
        "ALTER TABLE dpps ADD COLUMN folder_id INTEGER REFERENCES folders(id);"
    ]:
        async with engine.begin() as conn:
            try:
                await conn.execute(text(command))
                print(f"Successfully executed: {command}")
            except Exception as e:
                print(f"Skipped: {command} (Error: {e})")
                
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(migrate())
