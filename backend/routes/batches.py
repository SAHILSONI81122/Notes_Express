import random
import string
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from typing import List
from backend.database.database import get_db
from backend.models.models import Batch, User, RoleEnum, Institute
from backend.schemas.schemas import BatchCreate, BatchOut, UserOut
from backend.services.security import get_current_active_user

router = APIRouter(tags=["batches"])

def generate_invite_code():
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))

from datetime import datetime, timedelta
from sqlalchemy import select

@router.post("/batches", response_model=BatchOut)
async def create_batch(batch: BatchCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    std_code = generate_invite_code()
    tch_code = generate_invite_code()
    while tch_code == std_code:
        tch_code = generate_invite_code()

    from sqlalchemy.exc import IntegrityError
    
    # Create a new Institute for white-labelling (always distinct per new setup)
    institute = Institute(name=batch.name.strip(), logo_url=batch.logo_url or None)
    db.add(institute)
    try:
        await db.flush()  # get institute.id without committing
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=400, detail="An institute or group with this name already exists. Please choose a different name.")

    # Create the batch with a 24-hour expiration for the invite codes
    new_batch = Batch(
        name=batch.name,
        invite_code=std_code,
        invite_code_expires_at=datetime.utcnow() + timedelta(days=1),
        teacher_invite_code=tch_code,
        teacher_invite_code_expires_at=datetime.utcnow() + timedelta(days=1),
        address=batch.address,
        logo_url=batch.logo_url,
        teacher_id=current_user.id,
        institute_id=institute.id,
    )
    db.add(new_batch)
    await db.commit()
    await db.refresh(new_batch)
    
    # Automatically join the batch you created and become admin
    current_user.batch_id = new_batch.id
    current_user.role = RoleEnum.admin
    current_user.institute_id = institute.id
    
    from sqlalchemy.orm import selectinload
    result = await db.execute(select(User).options(selectinload(User.all_batches)).where(User.id == current_user.id))
    user = result.scalars().first()
    user.all_batches.append(new_batch)
    
    db.add(user)
    await db.commit()

    # Reload the batch with all required relationships to avoid MissingGreenletError
    final_result = await db.execute(
        select(Batch).options(
            selectinload(Batch.institute),
            selectinload(Batch.class_groups)
        ).where(Batch.id == new_batch.id)
    )
    return final_result.scalars().first()

@router.get("/batches/invite/{invite_code}")
async def get_invite_info(invite_code: str, db: AsyncSession = Depends(get_db)):
    from sqlalchemy.orm import selectinload
    result = await db.execute(select(Batch).options(selectinload(Batch.class_groups)).where(
        (Batch.invite_code == invite_code) | (Batch.teacher_invite_code == invite_code)
    ))
    batch = result.scalars().first()
    if not batch:
        raise HTTPException(status_code=404, detail="Invalid invite code")
    
    is_teacher = batch.teacher_invite_code == invite_code
    expiry = batch.teacher_invite_code_expires_at if is_teacher else batch.invite_code_expires_at
    if expiry and datetime.utcnow() > expiry:
        raise HTTPException(status_code=410, detail="Invite code has expired")
        
    return {
        "id": batch.id,
        "name": batch.name,
        "role": "teacher" if is_teacher else "student",
        "class_groups": [{"id": cg.id, "name": cg.name} for cg in batch.class_groups]
    }

@router.post("/batches/join")
async def join_batch(invite_code: str, class_group_id: int = None, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    result = await db.execute(select(Batch).where(
        (Batch.invite_code == invite_code) | (Batch.teacher_invite_code == invite_code)
    ))
    batch = result.scalars().first()
    if not batch:
        raise HTTPException(status_code=404, detail="Invalid invite code")
    
    is_teacher = batch.teacher_invite_code == invite_code
    expiry = batch.teacher_invite_code_expires_at if is_teacher else batch.invite_code_expires_at
    # Check expiration
    if expiry and datetime.utcnow() > expiry:
        raise HTTPException(status_code=410, detail="Invite code has expired. Please ask your teacher for a new one.")
    
    # Check if already joined
    from sqlalchemy.orm import selectinload
    result = await db.execute(select(User).options(selectinload(User.all_batches)).where(User.id == current_user.id))
    user = result.scalars().first()
    
    if batch not in user.all_batches:
        user.all_batches.append(batch)
    
    user.batch_id = batch.id
    user.institute_id = batch.institute_id
    if user.role != RoleEnum.admin:
        user.role = RoleEnum.teacher if is_teacher else RoleEnum.student
    
    if class_group_id:
        from backend.models.models import ClassGroup
        cg_res = await db.execute(select(ClassGroup).options(selectinload(ClassGroup.members)).where(ClassGroup.id == class_group_id, ClassGroup.batch_id == batch.id))
        cg = cg_res.scalars().first()
        if cg and user not in cg.members:
            cg.members.append(user)
            
    db.add(user)
    await db.commit()
    return {"message": "Successfully joined the coaching group", "batch": batch.name}

@router.post("/batches/switch/{batch_id}")
async def switch_batch(batch_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    # Check if user belongs to this batch
    from sqlalchemy.orm import selectinload
    result = await db.execute(select(User).options(selectinload(User.all_batches)).where(User.id == current_user.id))
    user = result.scalars().first()
    
    batch_ids = [b.id for b in user.all_batches]
    if batch_id not in batch_ids:
        raise HTTPException(status_code=403, detail="You do not belong to this group")
    
    user.batch_id = batch_id
    
    batch_res = await db.execute(select(Batch).where(Batch.id == batch_id))
    batch = batch_res.scalars().first()
    if batch:
        user.institute_id = batch.institute_id
        
    db.add(user)
    await db.commit()
    return {"message": "Switched to group successfully"}

@router.post("/batches/{batch_id}/refresh-invite", response_model=BatchOut)
async def refresh_invite_code(batch_id: int, role: str = "student", db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    result = await db.execute(select(Batch).where(Batch.id == batch_id))
    batch = result.scalars().first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    
    # Only the creator/teacher or admin can refresh
    if batch.teacher_id != current_user.id and current_user.role != RoleEnum.admin:
        raise HTTPException(status_code=403, detail="Not authorized to refresh invite code")
    
    if role == "teacher":
        batch.teacher_invite_code = generate_invite_code()
        batch.teacher_invite_code_expires_at = datetime.utcnow() + timedelta(days=1)
    else:
        batch.invite_code = generate_invite_code()
        batch.invite_code_expires_at = datetime.utcnow() + timedelta(days=1)  # 24-hour expiry
        
    await db.commit()
    await db.refresh(batch)
    return batch

@router.get("/batches", response_model=List[BatchOut])
async def get_batches(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    result = await db.execute(select(Batch))
    return result.scalars().all()

@router.get("/batches/{batch_id}/members", response_model=List[UserOut])
async def get_batch_members(batch_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    # Allow any member of the batch to view its members (for community size display)
    if current_user.role not in [RoleEnum.admin, RoleEnum.teacher] and current_user.batch_id != batch_id:
        raise HTTPException(status_code=403, detail="Not authorized to view members of this group")
    
    # Get all users who have this batch_id set OR are in the user_batches mapping
    from backend.models.models import user_batches
    from sqlalchemy.orm import selectinload
    query = select(User).options(
        selectinload(User.all_batches),
        selectinload(User.batch),
        selectinload(User.class_groups)
    ).where(
        (User.batch_id == batch_id) | (User.id.in_(select(user_batches.c.user_id).where(user_batches.c.batch_id == batch_id)))
    )
    
    result = await db.execute(query)
    members = result.scalars().all()
    
    print(f"DEBUG: Found {len(members)} members for batch {batch_id}")
    return members

@router.delete("/batches/{batch_id}/members/{user_id}")
async def remove_batch_member(batch_id: int, user_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    if current_user.role not in [RoleEnum.admin, RoleEnum.teacher] or current_user.batch_id != batch_id:
        raise HTTPException(status_code=403, detail="Not authorized to manage members")
    
    result = await db.execute(select(User).where(User.id == user_id, User.batch_id == batch_id))
    user_to_remove = result.scalars().first()
    
    if not user_to_remove:
        raise HTTPException(status_code=404, detail="User not found in this group")
    
    if user_to_remove.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot remove yourself")

    if user_to_remove.role == RoleEnum.teacher:
        raise HTTPException(status_code=400, detail="Cannot remove a teacher from the group")

    user_to_remove.batch_id = None
    user_to_remove.role = RoleEnum.student # Reset role if removed
    db.add(user_to_remove)
    await db.commit()
    return {"message": "Member removed successfully"}

@router.delete("/batches/{batch_id}/members/bulk-remove")
async def bulk_remove_batch_members(batch_id: int, user_ids: List[int], db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    if current_user.role not in [RoleEnum.admin, RoleEnum.teacher] or current_user.batch_id != batch_id:
        raise HTTPException(status_code=403, detail="Not authorized to manage members")
    
    from sqlalchemy import and_, update
    # Filter out self
    sanitized_user_ids = [uid for uid in user_ids if uid != current_user.id]
    
    if not sanitized_user_ids:
        return {"message": "No users to remove"}

    await db.execute(
        update(User).where(
            and_(
                User.id.in_(sanitized_user_ids),
                User.batch_id == batch_id,
                User.role != RoleEnum.teacher
            )
        ).values(batch_id=None, role=RoleEnum.student)
    )
    await db.commit()
    return {"message": "Successfully removed non-teacher members"}

@router.put("/batches/{batch_id}", response_model=BatchOut)
async def update_batch(batch_id: int, batch_in: BatchCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    # Only admin can update
    if current_user.role != RoleEnum.admin or current_user.batch_id != batch_id:
        raise HTTPException(status_code=403, detail="Only admins can update coaching info")
    
    result = await db.execute(select(Batch).where(Batch.id == batch_id))
    batch = result.scalars().first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    
    batch.name = batch_in.name
    batch.address = batch_in.address
    if batch_in.logo_url:
        batch.logo_url = batch_in.logo_url
        
    await db.commit()
    await db.refresh(batch)
    return batch

@router.put("/batches/{batch_id}/members/{user_id}/role")
async def update_member_role(batch_id: int, user_id: int, new_role: RoleEnum, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    if current_user.role != RoleEnum.admin or current_user.batch_id != batch_id:
        raise HTTPException(status_code=403, detail="Only admins can promote members")
    
    result = await db.execute(select(User).where(User.id == user_id, User.batch_id == batch_id))
    user_to_update = result.scalars().first()
    
    if not user_to_update:
        raise HTTPException(status_code=404, detail="User not found in this group")
        
    if new_role == RoleEnum.teacher:
        raise HTTPException(status_code=400, detail="Promoting to teacher is disabled")
    
    if user_to_update.role == RoleEnum.teacher and new_role != RoleEnum.teacher:
        raise HTTPException(status_code=400, detail="Cannot change or demote a teacher's role")
        
    user_to_update.role = new_role
    db.add(user_to_update)
    await db.commit()
    return {"message": f"Member role updated to {new_role}"}
