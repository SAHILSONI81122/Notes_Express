import asyncio
import asyncpg

async def main():
    conn = await asyncpg.connect('postgresql://postgres:postgres@localhost/notesexpress')
    try:
        # Get column info for folders table
        columns = await conn.fetch("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'folders';
        """)
        print("Folders table columns:")
        for col in columns:
            print(f"  {col['column_name']}: {col['data_type']}")
            
        # Get count of folders by type
        counts = await conn.fetch("""
            SELECT folder_type, COUNT(*) 
            FROM folders 
            GROUP BY folder_type;
        """)
        print("\nFolders count by type:")
        for r in counts:
            print(f"  Type: {r['folder_type']}, Count: {r['count']}")
            
    except Exception as e:
        print(f"Error: {e}")
    finally:
        await conn.close()

asyncio.run(main())
