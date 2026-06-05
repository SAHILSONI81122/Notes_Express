from fastapi import APIRouter, Depends, HTTPException, File, UploadFile
import os
import uuid
from backend.services.storage import upload_file_to_supabase, delete_file_from_supabase
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from typing import List
from datetime import datetime, timedelta
from backend.database.database import get_db
from backend.models.models import User, RoleEnum, user_class_groups
from backend.schemas.schemas import UserOut
from backend.services.security import get_current_active_user

router = APIRouter(tags=["users"])

UPLOAD_DIR = "backend/uploads"

@router.get("/students", response_model=List[UserOut])
async def get_students(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    if current_user.role not in [RoleEnum.teacher, RoleEnum.admin]:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    query = select(User).options(
        selectinload(User.batch),
        selectinload(User.all_batches),
        selectinload(User.class_groups)
    ).where(User.role == RoleEnum.student)
    result = await db.execute(query)
    return result.scalars().all()

@router.get("/teachers", response_model=List[UserOut])
async def get_teachers(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    if current_user.role != RoleEnum.admin:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    query = select(User).options(
        selectinload(User.batch),
        selectinload(User.all_batches),
        selectinload(User.class_groups)
    ).where(User.role == RoleEnum.teacher)
    result = await db.execute(query)
    return result.scalars().all()

@router.post("/heartbeat")
async def heartbeat(action: str = None, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    """Update the current user's last_active timestamp."""
    result = await db.execute(select(User).where(User.id == current_user.id))
    user = result.scalars().first()
    user.last_active = datetime.utcnow()
    user.current_action = action
    db.add(user)
    await db.commit()
    return {"status": "ok"}

@router.get("/class_groups/{class_group_id}/active_count")
async def get_active_count(class_group_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    """Get count of students active in the last 5 minutes for a class group."""
    if current_user.role not in [RoleEnum.admin, RoleEnum.teacher]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    cutoff = datetime.utcnow() - timedelta(minutes=5)
    
    from sqlalchemy import and_
    result = await db.execute(
        select(User).join(
            user_class_groups, User.id == user_class_groups.c.user_id
        ).where(
            and_(
                user_class_groups.c.class_group_id == class_group_id,
                User.role == RoleEnum.student,
                User.last_active >= cutoff
            )
        )
    )
    active_users = result.scalars().all()
    return {
        "class_group_id": class_group_id, 
        "active_count": len(active_users),
        "active_students": [
            {"id": u.id, "name": u.name, "avatar_url": u.avatar_url, "current_action": u.current_action} 
            for u in active_users
        ]
    }

@router.post("/me/avatar")
async def update_avatar(file: UploadFile = File(...), db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    # Read the file bytes
    file_bytes = await file.read()
    
    # Upload to Supabase
    public_url = await upload_file_to_supabase(
        file_bytes, 
        file.filename or "avatar.jpg", 
        file.content_type or "image/jpeg"
    )
    
    result = await db.execute(select(User).where(User.id == current_user.id))
    user = result.scalars().first()
    
    # Delete old avatar from storage if exists
    if user.avatar_url:
        await delete_file_from_supabase(user.avatar_url)
        
    user.avatar_url = public_url
    db.add(user)
    await db.commit()
    await db.refresh(user)
    
    return {"avatar_url": public_url}
    
from backend.models.models import Note, DPP, Attempt, NoteCompletion

@router.get("/leaderboard")
async def get_leaderboard(class_group_id: int = None, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    """Get top 50 students in the user's batch or class ranked by weekly gained XP dynamically."""
    
    from sqlalchemy import func
    
    now = datetime.utcnow()
    # Start of current week (Monday 00:00:00 UTC)
    start_of_week = now - timedelta(days=now.weekday())
    start_of_week = start_of_week.replace(hour=0, minute=0, second=0, microsecond=0)
    
    if class_group_id:
        if current_user.role == RoleEnum.student:
            # Check if student is in this class group
            user_res = await db.execute(
                select(User).where(User.id == current_user.id).options(selectinload(User.class_groups))
            )
            user = user_res.scalars().first()
            user_cg_ids = [cg.id for cg in user.class_groups]
            if class_group_id not in user_cg_ids:
                raise HTTPException(status_code=403, detail="Access denied to this class group leaderboard")

        # Class-specific students
        students_query = select(User).join(user_class_groups).where(
            user_class_groups.c.class_group_id == class_group_id,
            User.role == RoleEnum.student
        )
        # Note XP
        note_query = select(NoteCompletion.user_id, func.count(func.distinct(NoteCompletion.note_id))).join(Note).where(
            Note.class_group_id == class_group_id,
            NoteCompletion.completed_at >= start_of_week,
            NoteCompletion.is_completed == True
        ).group_by(NoteCompletion.user_id)
        # DPP XP
        dpp_query = select(Attempt.user_id, func.count(func.distinct(Attempt.dpp_id))).join(DPP).where(
            DPP.class_group_id == class_group_id,
            Attempt.completed == True,
            Attempt.submitted_at >= start_of_week
        ).group_by(Attempt.user_id)
    else:
        if current_user.role == RoleEnum.student:
            # For students, only show students from class groups they are part of.
            # If they are not in any class groups, return empty leaderboard.
            user_res = await db.execute(
                select(User).where(User.id == current_user.id).options(selectinload(User.class_groups))
            )
            user = user_res.scalars().first()
            user_cg_ids = [cg.id for cg in user.class_groups if cg.batch_id == current_user.batch_id]
            
            if not user_cg_ids:
                return {
                    "leaderboard": [],
                    "my_rank": 0,
                    "has_any_xp": False
                }
            
            students_query = select(User).join(user_class_groups).where(
                user_class_groups.c.class_group_id.in_(user_cg_ids),
                User.role == RoleEnum.student
            ).distinct()
            
            # Note XP
            note_query = select(NoteCompletion.user_id, func.count(func.distinct(NoteCompletion.note_id))).join(Note).where(
                Note.class_group_id.in_(user_cg_ids),
                NoteCompletion.completed_at >= start_of_week,
                NoteCompletion.is_completed == True
            ).group_by(NoteCompletion.user_id)
            
            # DPP XP
            dpp_query = select(Attempt.user_id, func.count(func.distinct(Attempt.dpp_id))).join(DPP).where(
                DPP.class_group_id.in_(user_cg_ids),
                Attempt.completed == True,
                Attempt.submitted_at >= start_of_week
            ).group_by(Attempt.user_id)
        else:
            # Global batch students (for admin/teacher)
            students_query = select(User).where(
                User.batch_id == current_user.batch_id,
                User.role == RoleEnum.student
            )
            # Note XP
            note_query = select(NoteCompletion.user_id, func.count(func.distinct(NoteCompletion.note_id))).join(Note).where(
                Note.batch_id == current_user.batch_id,
                NoteCompletion.completed_at >= start_of_week,
                NoteCompletion.is_completed == True
            ).group_by(NoteCompletion.user_id)
            # DPP XP
            dpp_query = select(Attempt.user_id, func.count(func.distinct(Attempt.dpp_id))).join(DPP).where(
                DPP.batch_id == current_user.batch_id,
                Attempt.completed == True,
                Attempt.submitted_at >= start_of_week
            ).group_by(Attempt.user_id)
        
    students = (await db.execute(students_query)).scalars().all()
    note_counts = dict((await db.execute(note_query)).all())
    dpp_counts = dict((await db.execute(dpp_query)).all())
    
    leaderboard_data = []
    has_any_xp = False
    for s in students:
        calculated_xp = (note_counts.get(s.id, 0) * 10) + (dpp_counts.get(s.id, 0) * 50)
        if calculated_xp > 0:
            has_any_xp = True
        leaderboard_data.append({
            "id": s.id,
            "name": s.name,
            "avatar_url": s.avatar_url,
            "xp": calculated_xp,
            "level": (calculated_xp // 500) + 1
        })
        
    # Sort students by XP descending, and then by name alphabetically for ties (like 0 XP)
    leaderboard_data.sort(key=lambda x: (-x["xp"], x["name"].lower()))
        
    # Get rank of the current user based on their position in the sorted list
    my_rank = next((i + 1 for i, s in enumerate(leaderboard_data) if s["id"] == current_user.id), 0)
    
    # Return top 50
    return {
        "leaderboard": leaderboard_data[:50],
        "my_rank": my_rank,
        "has_any_xp": has_any_xp
    }
