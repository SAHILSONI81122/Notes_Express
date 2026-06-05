from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
import uuid
import os
from backend.services.security import get_current_active_user
from backend.models.models import User
from backend.services.storage import get_supabase_client, BUCKET_NAME

router = APIRouter(tags=["upload"])

class UploadUrlRequest(BaseModel):
    filename: str
    content_type: str

class UploadUrlResponse(BaseModel):
    signed_url: str
    public_url: str

@router.post("/get-upload-url", response_model=UploadUrlResponse)
async def get_upload_url(request: UploadUrlRequest, current_user: User = Depends(get_current_active_user)):
    """
    Generates a Supabase Signed Upload URL so the client can upload large files
    directly to Supabase, bypassing Vercel's 4.5 MB limit.
    """
    try:
        supabase = get_supabase_client()
        ext = os.path.splitext(request.filename)[1].lower()
        unique_filename = f"{uuid.uuid4()}{ext}"
        
        # Generate signed upload URL
        # create_signed_upload_url returns a dict like {'signedUrl': 'https://...', 'path': '...', 'token': '...'}
        res = supabase.storage.from_(BUCKET_NAME).create_signed_upload_url(unique_filename)
        
        if 'signedUrl' not in res:
            # Fallback if create_signed_upload_url has a different response shape or fails
            # Sometimes it's 'signedURL'
            signed_url = res.get('signedURL', res.get('signed_url'))
            if not signed_url:
                raise Exception(f"Unexpected response from Supabase: {res}")
        else:
            signed_url = res['signedUrl']
            
        # Determine the final public URL
        public_url = supabase.storage.from_(BUCKET_NAME).get_public_url(unique_filename)
        
        return UploadUrlResponse(
            signed_url=signed_url,
            public_url=public_url
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate upload URL: {str(e)}")
