import asyncio
from sqlalchemy import text
from backend.database.database import engine

async def check():
    async with engine.connect() as conn:
        try:
            res = await conn.execute(text("SELECT email, password FROM users"))
            users = res.all()
            if not users:
                print("No users found in database.")
            for user in users:
                print(f"Email: {user[0]}, Password: {user[1]}")
        except Exception as e:
            print(f"Error: {e}")
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(check())
