import asyncio
import asyncpg

async def main():
    conn = await asyncpg.connect('postgresql://postgres:postgres@localhost/notesexpress')
    records = await conn.fetch("SELECT id, name, xp, email FROM users WHERE name LIKE '%Michael%'")
    for r in records:
        print(dict(r))
    
    # Also fetch Michael's completed notes count and DPP count
    if records:
        uid = records[0]['id']
        notes = await conn.fetch("SELECT COUNT(*) FROM note_completions WHERE user_id = $1", uid)
        dpps = await conn.fetch("SELECT COUNT(*) FROM attempts WHERE user_id = $1 AND completed = TRUE", uid)
        print(f"Notes completed: {notes[0]['count']}, DPPs completed: {dpps[0]['count']}")
        print(f"Calculated XP should be: {notes[0]['count'] * 10 + dpps[0]['count'] * 50}")
    await conn.close()

asyncio.run(main())
