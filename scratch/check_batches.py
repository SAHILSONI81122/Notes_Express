import asyncio
import asyncpg

async def main():
    conn = await asyncpg.connect('postgresql://postgres:postgres@localhost/notesexpress')
    records = await conn.fetch("SELECT id, name, logo_url, address FROM batches")
    for r in records:
        print(dict(r))
    await conn.close()

asyncio.run(main())
