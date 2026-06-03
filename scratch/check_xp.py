import asyncio
import asyncpg

async def main():
    conn = await asyncpg.connect('postgresql://postgres:postgres@localhost/notesexpress')
    
    # 1. Fetch user info
    user = await conn.fetchrow("SELECT id, name, email, xp, level, streak_count, last_streak_date FROM users WHERE id = 4")
    print("USER DATA:")
    print(dict(user))
    print("-" * 50)
    
    # 2. Fetch completed notes
    completed_notes = await conn.fetch("SELECT note_id, is_completed FROM note_completions WHERE user_id = 4 AND is_completed = true")
    print(f"COMPLETED NOTES COUNT: {len(completed_notes)}")
    for note in completed_notes:
        print(dict(note))
    print("-" * 50)
    
    # 3. Fetch DPP attempts
    dpp_attempts = await conn.fetch("SELECT dpp_id, questions_attempted, correct_questions, completed FROM attempts WHERE user_id = 4")
    print(f"DPP ATTEMPTS COUNT: {len(dpp_attempts)}")
    for a in dpp_attempts:
        print(dict(a))
        
    await conn.close()

if __name__ == "__main__":
    asyncio.run(main())
