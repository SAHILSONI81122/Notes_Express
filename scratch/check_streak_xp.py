import asyncio
import asyncpg
from datetime import datetime, date

async def main():
    conn = await asyncpg.connect('postgresql://postgres:postgres@localhost/notesexpress')
    
    # 1. Fetch user's completion status
    # Notes: get all completed note completions with completed_at
    note_records = await conn.fetch("""
        SELECT note_id, completed_at 
        FROM note_completions 
        WHERE user_id = 4 AND is_completed = true AND completed_at IS NOT NULL
    """)
    
    # DPPs: get all completed attempts with submitted_at
    # If questions_attempted > 0, MCQ: max(10, correct_questions * 10)
    # If questions_attempted = 0, Toggle: 50
    # Also fetch the DPP type/details by joining or checking questions
    dpp_records = await conn.fetch("""
        SELECT a.dpp_id, a.submitted_at, a.questions_attempted, a.correct_questions
        FROM attempts a
        WHERE a.user_id = 4 AND a.completed = true AND a.submitted_at IS NOT NULL
    """)
    
    print("Notes completed:")
    for nr in note_records:
        print(dict(nr))
        
    print("\nDPPs completed:")
    for dr in dpp_records:
        print(dict(dr))
        
    # Group items by date
    days_data = {}
    
    for nr in note_records:
        dt = nr['completed_at'].date()
        days_data.setdefault(dt, []).append({
            'type': 'note',
            'id': nr['note_id'],
            'base_xp': 20
        })
        
    for dr in dpp_records:
        dt = dr['submitted_at'].date()
        qa = dr['questions_attempted'] or 0
        correct = dr['correct_questions'] or 0
        base_xp = max(10, correct * 10) if qa > 0 else 50
        days_data.setdefault(dt, []).append({
            'type': 'dpp',
            'id': dr['dpp_id'],
            'base_xp': base_xp
        })
        
    sorted_dates = sorted(days_data.keys())
    print("\nSorted dates of activity:", sorted_dates)
    
    # Reconstruct streak and calculate XP
    total_xp = 0
    current_streak = 0
    prev_date = None
    
    for d in sorted_dates:
        if prev_date is None:
            current_streak = 1
        else:
            diff = (d - prev_date).days
            if diff == 1:
                current_streak += 1
            elif diff > 1:
                current_streak = 1
        
        is_bonus_day = current_streak > 0 and current_streak % 6 == 0
        multiplier = 2 if is_bonus_day else 1
        
        day_xp = sum(item['base_xp'] for item in days_data[d])
        day_gained = day_xp * multiplier
        total_xp += day_gained
        
        print(f"Date: {d} | Streak: {current_streak} | Bonus: {is_bonus_day} | Base Day XP: {day_xp} | Gained: {day_gained}")
        
        prev_date = d
        
    print(f"\nCalculated Total XP: {total_xp}")
    
    # Let's check DPP 8 details (submitted_at)
    dpp8 = await conn.fetchrow("SELECT submitted_at FROM attempts WHERE user_id = 4 AND dpp_id = 8")
    print(f"\nDPP 8 submitted_at: {dict(dpp8) if dpp8 else 'None'}")
    
    await conn.close()

if __name__ == "__main__":
    asyncio.run(main())
