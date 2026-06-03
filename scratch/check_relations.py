import asyncio
import asyncpg

async def main():
    conn = await asyncpg.connect('postgresql://postgres:postgres@localhost/notesexpress')
    
    # User's batch
    user = await conn.fetchrow("SELECT batch_id FROM users WHERE id = 4")
    batch_id = user['batch_id']
    print(f"User batch_id: {batch_id}")
    
    # Class groups for this user
    user_classes = await conn.fetch("""
        SELECT cg.id, cg.name 
        FROM class_groups cg
        JOIN user_class_groups ucg ON ucg.class_group_id = cg.id
        WHERE ucg.user_id = 4
    """)
    print("User Class Groups:")
    for uc in user_classes:
        print(dict(uc))
        
    # All notes in the system and their class groups
    notes = await conn.fetch("SELECT id, title, class_group_id, batch_id FROM notes")
    print("\nAll Notes in DB:")
    for n in notes:
        print(dict(n))
        
    # All DPPs in the system and their class groups
    dpps = await conn.fetch("SELECT id, title, class_group_id, batch_id FROM dpps")
    print("\nAll DPPs in DB:")
    for d in dpps:
        print(dict(d))
        
    await conn.close()

if __name__ == "__main__":
    asyncio.run(main())
