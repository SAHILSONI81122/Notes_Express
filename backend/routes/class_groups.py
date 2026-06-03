from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from typing import List
from backend.database.database import get_db
from backend.models.models import ClassGroup, User, Batch, RoleEnum, user_class_groups
from backend.schemas.schemas import ClassGroupCreate, ClassGroupOut, UserOut
from backend.services.security import get_current_active_user

router = APIRouter(prefix="/batches", tags=["class_groups"])

@router.post("/{batch_id}/class_groups", response_model=ClassGroupOut)
async def create_class_group(batch_id: int, group_in: ClassGroupCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    if current_user.role not in [RoleEnum.admin, RoleEnum.teacher]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    new_group = ClassGroup(name=group_in.name, batch_id=batch_id)
    db.add(new_group)
    await db.commit()
    await db.refresh(new_group)
    return new_group

@router.get("/{batch_id}/class_groups", response_model=List[ClassGroupOut])
async def get_class_groups(batch_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    result = await db.execute(select(ClassGroup).options(selectinload(ClassGroup.members)).where(ClassGroup.batch_id == batch_id))
    groups = result.scalars().all()
    for g in groups:
        g.member_count = len(g.members)
    return groups

@router.post("/class_groups/{class_group_id}/members/{user_id}")
async def add_member_to_class_group(class_group_id: int, user_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    if current_user.role not in [RoleEnum.admin, RoleEnum.teacher]:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    group_res = await db.execute(select(ClassGroup).options(selectinload(ClassGroup.members)).where(ClassGroup.id == class_group_id))
    group = group_res.scalars().first()
    if not group:
        raise HTTPException(status_code=404, detail="Class Group not found")
        
    user_res = await db.execute(select(User).where(User.id == user_id))
    user = user_res.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    group.members.append(user)
    await db.commit()
    return {"message": "User added to class group"}

@router.delete("/class_groups/{class_group_id}/members/{user_id}")
async def remove_member_from_class_group(class_group_id: int, user_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    if current_user.role not in [RoleEnum.admin, RoleEnum.teacher]:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    group_res = await db.execute(select(ClassGroup).options(selectinload(ClassGroup.members)).where(ClassGroup.id == class_group_id))
    group = group_res.scalars().first()
    if not group:
        raise HTTPException(status_code=404, detail="Class Group not found")
        
    user_res = await db.execute(select(User).where(User.id == user_id))
    user = user_res.scalars().first()
    if not user or user not in group.members:
        raise HTTPException(status_code=404, detail="User not found in this group")
        
    group.members.remove(user)
    await db.commit()
    return {"message": "User removed from class group"}
