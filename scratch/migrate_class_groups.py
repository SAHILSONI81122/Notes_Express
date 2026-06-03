import asyncio
from sqlalchemy import text
from backend.database.database import engine, Base
from backend.models.models import *

async def migrate_db():
    print("Starting migration...")
    async with engine.begin() as conn:
        # Create new tables (ClassGroup, user_class_groups)
        await conn.run_sync(Base.metadata.create_all)
        print("Created new tables.")
        
        # Add class_group_id to existing tables
        alter_queries = [
            "ALTER TABLE folders ADD COLUMN IF NOT EXISTS class_group_id INTEGER REFERENCES class_groups(id);",
            "ALTER TABLE notes ADD COLUMN IF NOT EXISTS class_group_id INTEGER REFERENCES class_groups(id);",
            "ALTER TABLE dpps ADD COLUMN IF NOT EXISTS class_group_id INTEGER REFERENCES class_groups(id);"
        ]
        
        for q in alter_queries:
            try:
                await conn.execute(text(q))
                print(f"Executed: {q}")
            except Exception as e:
                print(f"Error on {q}: {e}")

    print("Migration complete.")

if __name__ == "__main__":
    asyncio.run(migrate_db())
