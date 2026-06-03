import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

DATABASE_URL = "postgresql+asyncpg://postgres:postgres@localhost/notesexpress"

async def migrate():
    engine = create_async_engine(DATABASE_URL)
    async with engine.begin() as conn:
        try:
            await conn.execute(text("""
                CREATE TABLE note_completions (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER REFERENCES users(id) NOT NULL,
                    note_id INTEGER REFERENCES notes(id) NOT NULL,
                    completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """))
            print("Successfully created note_completions table")
        except Exception as e:
            print(f"Error or already exists: {e}")
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(migrate())
