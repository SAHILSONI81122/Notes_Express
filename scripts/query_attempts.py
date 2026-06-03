import asyncio
import asyncpg

async def main():
    conn = await asyncpg.connect('postgresql://postgres:postgres@localhost/notesexpress')
    attempts = await conn.fetch("SELECT * FROM attempts WHERE user_id = 4")
    for a in attempts:
        print(dict(a))
    await conn.close()

asyncio.run(main())






