import asyncio
import asyncpg

async def main():
    conn = await asyncpg.connect('postgresql://postgres:postgres@localhost/notesexpress')
    records = await conn.fetch("SELECT note_id, is_completed, completed_at FROM note_completions WHERE user_id = 4")
    for r in records:
        print(dict(r))
    await conn.close()

if __name__ == "__main__":
    asyncio.run(main())
