import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from datetime import datetime

async def migrate():
    engine = create_async_engine('postgresql+asyncpg://postgres:postgres@localhost/notesexpress')
    async with engine.begin() as conn:
        try:
            # 1. Create institutes table
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS institutes (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR NOT NULL UNIQUE,
                    logo_url VARCHAR,
                    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
                );
            """))
            print("Successfully created institutes table")
            
            # 2. Alter users and batches
            try:
                await conn.execute(text("ALTER TABLE users ADD COLUMN institute_id INTEGER REFERENCES institutes(id);"))
                print("Added institute_id to users")
            except Exception as e:
                print(f"users.institute_id might already exist: {e}")
                
            try:
                await conn.execute(text("ALTER TABLE batches ADD COLUMN institute_id INTEGER REFERENCES institutes(id);"))
                print("Added institute_id to batches")
            except Exception as e:
                print(f"batches.institute_id might already exist: {e}")
            
            # 3. Create default institute
            res = await conn.execute(text("INSERT INTO institutes (name) VALUES ('Notes Express Core') ON CONFLICT DO NOTHING RETURNING id;"))
            row = res.fetchone()
            
            if row:
                default_id = row[0]
            else:
                # Get the existing one if it was already created
                res = await conn.execute(text("SELECT id FROM institutes WHERE name = 'Notes Express Core';"))
                default_id = res.fetchone()[0]
                
            # 4. Assign to all existing users and batches
            await conn.execute(text("UPDATE users SET institute_id = :id WHERE institute_id IS NULL;"), {"id": default_id})
            await conn.execute(text("UPDATE batches SET institute_id = :id WHERE institute_id IS NULL;"), {"id": default_id})
            print(f"Successfully migrated all users and batches to default institute ID: {default_id}")
            
        except Exception as e:
            print(f"Migration Error: {e}")
            
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(migrate())
