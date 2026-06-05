from fastapi import APIRouter, Depends, HTTPException, File, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import or_
from sqlalchemy.orm import selectinload
from typing import List
import uuid
import os
import io
from PIL import Image
from backend.database.database import get_db
from backend.models.models import Note, Folder, User, RoleEnum
from backend.schemas.schemas import NoteCreate, NoteOut, FolderCreate, FolderOut
from backend.services.security import get_current_active_user
from backend.services.upload_validation import (
    validate_upload,
    ALLOWED_NOTE_EXTS, ALLOWED_NOTE_MIMES,
    ALLOWED_IMAGE_EXTS, ALLOWED_IMAGE_MIMES,
    MAX_PDF_SIZE_MB, MAX_IMAGE_SIZE_MB,
)

from backend.services.storage import upload_file_to_supabase, delete_file_from_supabase

from pydantic import BaseModel

class RenameRequest(BaseModel):
    name: str

router = APIRouter(tags=["notes"])

@router.post("/upload-file")
async def upload_file(file: UploadFile = File(...), current_user: User = Depends(get_current_active_user)):
    """Upload a file (PDF or image). Used for notes and coaching logos."""
    content = await validate_upload(
        file,
        allowed_exts=ALLOWED_NOTE_EXTS | {'.jpg', '.jpeg', '.png', '.gif', '.webp'},
        allowed_mimes=ALLOWED_NOTE_MIMES,
        max_mb=MAX_PDF_SIZE_MB,
        label="File",
    )
    public_url = await upload_file_to_supabase(content, file.filename or "file.bin", file.content_type or "application/octet-stream")
    return {"file_url": public_url}

@router.post("/upload-images-to-pdf")
async def upload_images_to_pdf(files: List[UploadFile] = File(...), current_user: User = Depends(get_current_active_user)):
    """Convert uploaded images to a single PDF. Max 10 MB per image."""
    if current_user.role not in [RoleEnum.teacher, RoleEnum.admin]:
        raise HTTPException(status_code=403, detail="Only teachers/admins can upload notes")

    if not files:
        raise HTTPException(status_code=400, detail="No images provided")
    if len(files) > 30:
        raise HTTPException(status_code=400, detail="Maximum 30 images allowed per upload.")

    image_list = []
    try:
        for file in files:
            content = await validate_upload(
                file,
                allowed_exts=ALLOWED_IMAGE_EXTS,
                allowed_mimes=ALLOWED_IMAGE_MIMES,
                max_mb=MAX_IMAGE_SIZE_MB,
                label="Image",
            )
            img = Image.open(io.BytesIO(content)).convert("RGB")
            image_list.append(img)

        if not image_list:
            raise HTTPException(status_code=400, detail="No valid images found")

        pdf_bytes = io.BytesIO()
        image_list[0].save(pdf_bytes, format="PDF", save_all=True, append_images=image_list[1:])
        pdf_bytes.seek(0)
        
        public_url = await upload_file_to_supabase(pdf_bytes.read(), "merged.pdf", "application/pdf")
        return {"file_url": public_url}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/create-folder", response_model=FolderOut)
async def create_folder(folder: FolderCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    if current_user.role not in [RoleEnum.teacher, RoleEnum.admin]:
        raise HTTPException(status_code=403, detail="Only teachers/admins can create folders")
    
    new_folder = Folder(
        name=folder.name,
        batch_id=folder.batch_id,
        class_group_id=folder.class_group_id,
        parent_id=folder.parent_id,
        folder_type=folder.folder_type,
        created_by=current_user.id
    )
    db.add(new_folder)
    await db.commit()
    await db.refresh(new_folder)
    return new_folder

@router.get("/folders/{batch_id}", response_model=List[FolderOut])
async def get_folders(batch_id: int, class_group_id: int = None, parent_id: int = None, folder_type: str = "notes", search: str = None, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    if current_user.role == RoleEnum.student and current_user.batch_id != batch_id:
        raise HTTPException(status_code=403, detail="Access denied")
        
    query = select(Folder).where(Folder.batch_id == batch_id, Folder.folder_type == folder_type)
    if current_user.role == RoleEnum.student:
        user_res = await db.execute(select(User).where(User.id == current_user.id).options(selectinload(User.class_groups)))
        user = user_res.scalars().first()
        user_cg_ids = [cg.id for cg in user.class_groups if cg.batch_id == batch_id]
        if user_cg_ids:
            query = query.where(Folder.class_group_id.in_(user_cg_ids))
        else:
            return [] # No global notes
    else:
        if class_group_id:
            query = query.where(Folder.class_group_id == class_group_id)
        else:
            return [] # Force admin/teacher to select a class
    
    if search:
        query = query.where(Folder.name.ilike(f"%{search}%"))
    else:
        if parent_id:
            query = query.where(Folder.parent_id == parent_id)
        else:
            query = query.where(Folder.parent_id == None)
            
    result = await db.execute(query)
    return result.scalars().all()

@router.post("/upload-note", response_model=NoteOut)
async def upload_note(note: NoteCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    if current_user.role not in [RoleEnum.teacher, RoleEnum.admin]:
        raise HTTPException(status_code=403, detail="Only teachers/admins can upload notes")
    
    new_note = Note(
        title=note.title,
        file_url=note.file_url,
        batch_id=note.batch_id,
        class_group_id=note.class_group_id,
        folder_id=note.folder_id,
        uploaded_by=current_user.id
    )
    db.add(new_note)
    await db.commit()
    await db.refresh(new_note)
    
    # Trigger push notifications
    try:
        from backend.services.notifications import send_push_notifications
        from sqlalchemy.orm import selectinload
        
        # Base query to get students in the batch with push tokens
        stmt = select(User).where(User.batch_id == note.batch_id, User.role == RoleEnum.student, User.expo_push_token.is_not(None))
        
        # If class_group_id is specified, filter by class group
        if note.class_group_id:
            stmt = stmt.options(selectinload(User.class_groups))
            
        result = await db.execute(stmt)
        users = result.scalars().all()
        
        tokens = []
        for u in users:
            if note.class_group_id:
                if any(cg.id == note.class_group_id for cg in u.class_groups):
                    tokens.append(u.expo_push_token)
            else:
                tokens.append(u.expo_push_token)
                
        if tokens:
            # Optionally use BackgroundTasks to not block the request
            send_push_notifications(tokens, f"New Note Added: {note.title}")
    except Exception as e:
        print(f"Error sending push notification: {e}")
        
    return new_note

@router.get("/notes/{batch_id}", response_model=List[NoteOut])
async def get_notes(batch_id: int, class_group_id: int = None, folder_id: int = None, search: str = None, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    if current_user.role == RoleEnum.student and current_user.batch_id != batch_id:
        raise HTTPException(status_code=403, detail="Access denied")
        
    query = select(Note).where(Note.batch_id == batch_id)
    if current_user.role == RoleEnum.student:
        user_res = await db.execute(select(User).where(User.id == current_user.id).options(selectinload(User.class_groups)))
        user = user_res.scalars().first()
        user_cg_ids = [cg.id for cg in user.class_groups if cg.batch_id == batch_id]
        if user_cg_ids:
            query = query.where(Note.class_group_id.in_(user_cg_ids))
        else:
            return [] # No global notes
    else:
        if class_group_id:
            query = query.where(Note.class_group_id == class_group_id)
        else:
            return [] # Force admin/teacher to select a class
    
    if search:
        query = query.where(Note.title.ilike(f"%{search}%"))
    else:
        if folder_id:
            query = query.where(Note.folder_id == folder_id)
        else:
            query = query.where(Note.folder_id == None)
            
    result = await db.execute(query)
    return result.scalars().all()
@router.put("/notes/{note_id}/rename")
async def rename_note(note_id: int, request: RenameRequest, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    if current_user.role not in [RoleEnum.admin, RoleEnum.teacher]:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    result = await db.execute(select(Note).where(Note.id == note_id))
    note = result.scalars().first()
    if not note: raise HTTPException(status_code=404, detail="Note not found")
    note.title = request.name
    await db.commit()
    return note

@router.put("/folders/{folder_id}/rename")
async def rename_folder(folder_id: int, request: RenameRequest, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    if current_user.role not in [RoleEnum.admin, RoleEnum.teacher]:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    result = await db.execute(select(Folder).where(Folder.id == folder_id))
    folder = result.scalars().first()
    if not folder: raise HTTPException(status_code=404, detail="Folder not found")
    folder.name = request.name
    await db.commit()
    return folder

@router.delete("/notes/{note_id}")
async def delete_note(note_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    if current_user.role not in [RoleEnum.admin, RoleEnum.teacher]:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    result = await db.execute(select(Note).where(Note.id == note_id))
    note = result.scalars().first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
        
    if note.file_url:
        await delete_file_from_supabase(note.file_url)
        
    await db.delete(note)
    await db.commit()
    return {"message": "Note deleted successfully"}
@router.delete("/folders/{folder_id}")
async def delete_folder(folder_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    if current_user.role not in [RoleEnum.admin, RoleEnum.teacher]:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    result = await db.execute(select(Folder).where(Folder.id == folder_id))
    folder = result.scalars().first()
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")
        
    from backend.models.models import Note, DPP
    # Recursive deletion helper
    async def recursive_delete(fid: int):
        # 1. Delete notes
        notes_res = await db.execute(select(Note).where(Note.folder_id == fid))
        for note in notes_res.scalars().all():
            if note.file_url:
                await delete_file_from_supabase(note.file_url)
            await db.delete(note)
            
        # 2. Delete DPPs
        dpps_res = await db.execute(select(DPP).where(DPP.folder_id == fid))
        for dpp in dpps_res.scalars().all():
            if dpp.file_url:
                await delete_file_from_supabase(dpp.file_url)
            await db.delete(dpp)
            
        # 3. Delete subfolders
        subs_res = await db.execute(select(Folder).where(Folder.parent_id == fid))
        for sub in subs_res.scalars().all():
            await recursive_delete(sub.id)
            await db.delete(sub)

    await recursive_delete(folder_id)
    await db.delete(folder)
    await db.commit()
    return {"message": "Folder and its contents deleted recursively"}
