import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

async def main():
    engine = create_async_engine('postgresql+asyncpg://postgres:postgres@localhost/notesexpress')
    async with engine.begin() as conn:
        res = await conn.execute(text("SELECT id, email, role, expo_push_token FROM users"))
        print(res.fetchall())
    await engine.dispose()

asyncio.run(main())
