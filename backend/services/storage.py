import os
import uuid
from supabase import create_client, Client
from fastapi import HTTPException

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

BUCKET_NAME = "notes-express-uploads"

def get_supabase_client() -> Client:
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise HTTPException(status_code=500, detail="Supabase Storage credentials are not configured.")
    return create_client(SUPABASE_URL, SUPABASE_KEY)

async def upload_file_to_supabase(file_bytes: bytes, file_name: str, content_type: str) -> str:
    """
    Uploads a file to Supabase Storage and returns the public URL.
    Generates a unique filename to prevent collisions.
    """
    try:
        supabase = get_supabase_client()
        ext = os.path.splitext(file_name)[1].lower()
        unique_filename = f"{uuid.uuid4()}{ext}"
        
        # Upload the file
        res = supabase.storage.from_(BUCKET_NAME).upload(
            file=file_bytes,
            path=unique_filename,
            file_options={"content-type": content_type}
        )
        
        # Get public URL
        public_url = supabase.storage.from_(BUCKET_NAME).get_public_url(unique_filename)
        return public_url
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload file to storage: {str(e)}")

async def delete_file_from_supabase(file_url: str):
    """
    Deletes a file from Supabase Storage given its public URL.
    """
    try:
        if not file_url or BUCKET_NAME not in file_url:
            return
            
        # Extract the filename from the URL
        # Example URL: https://[project].supabase.co/storage/v1/object/public/notes-express-uploads/filename.pdf
        filename = file_url.split(f"{BUCKET_NAME}/")[-1]
        
        supabase = get_supabase_client()
        supabase.storage.from_(BUCKET_NAME).remove([filename])
    except Exception as e:
        print(f"Failed to delete file from storage: {e}")
