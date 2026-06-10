import asyncio
from sqlalchemy import text
from backend.database.database import engine

async def add_indexes():
    async with engine.begin() as conn:
        print("Adding indexes...")
        
        # NoteCompletion user_id
        try:
            await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_note_completions_user_id ON note_completions (user_id);"))
            print("Added index to note_completions(user_id)")
        except Exception as e:
            print(f"Error on note_completions: {e}")
            
        # Attempt user_id
        try:
            await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_attempts_user_id ON attempts (user_id);"))
            print("Added index to attempts(user_id)")
        except Exception as e:
            print(f"Error on attempts: {e}")
            
        # UserBooster user_id
        try:
            await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_user_boosters_user_id ON user_boosters (user_id);"))
            print("Added index to user_boosters(user_id)")
        except Exception as e:
            print(f"Error on user_boosters: {e}")
            
        # UserChestClaim user_id
        try:
            await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_user_chest_claims_user_id ON user_chest_claims (user_id);"))
            print("Added index to user_chest_claims(user_id)")
        except Exception as e:
            print(f"Error on user_chest_claims: {e}")
            
        # StreakFreeze user_id
        try:
            await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_streak_freezes_user_id ON streak_freezes (user_id);"))
            print("Added index to streak_freezes(user_id)")
        except Exception as e:
            print(f"Error on streak_freezes: {e}")

        print("Done!")

if __name__ == "__main__":
    asyncio.run(add_indexes())
