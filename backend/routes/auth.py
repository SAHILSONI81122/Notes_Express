from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from backend.database.database import get_db
from backend.models.models import User
from backend.schemas.schemas import UserCreate, UserOut, Token
from backend.services.security import get_password_hash, verify_password, create_access_token, ACCESS_TOKEN_EXPIRE_MINUTES, get_current_active_user
from datetime import timedelta

router = APIRouter(tags=["auth"])

from sqlalchemy.orm import selectinload
from backend.services.limiter import limiter

@router.post("/signup", response_model=UserOut)
@limiter.limit("5/minute")
async def signup(request: Request, user: UserCreate, db: AsyncSession = Depends(get_db)):
    try:

        normalized_email = user.email.strip().lower()
        result = await db.execute(select(User).where(User.email == normalized_email))
        if result.scalars().first():
            raise HTTPException(status_code=400, detail="Email already registered")
        
        hashed_password = get_password_hash(user.password)
        new_user = User(
            name=user.name.strip(),
            email=normalized_email,
            password=hashed_password,
            role=user.role,
            batch_id=user.batch_id
        )
        db.add(new_user)
        await db.commit()
        
        # Eager load relationships to prevent async MissingGreenlet errors during Pydantic serialization
        stmt = select(User).options(
            selectinload(User.batch),
            selectinload(User.all_batches),
            selectinload(User.class_groups),
            selectinload(User.institute)
        ).where(User.id == new_user.id)
        
        result = await db.execute(stmt)
        created_user = result.scalars().first()
        
        return created_user
    except Exception as e:
        print(f"Signup error: {str(e)}")
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/login", response_model=Token)
@limiter.limit("10/minute")
async def login(request: Request, form_data: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    normalized_email = form_data.username.strip().lower()
    result = await db.execute(select(User).where(User.email == normalized_email))
    user = result.scalars().first()
    if not user or not verify_password(form_data.password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email, "role": user.role.value, "id": user.id}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me", response_model=UserOut)
async def get_me(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    from backend.models.models import RoleEnum, NoteCompletion, Note
    from sqlalchemy import func
    from sqlalchemy.orm import selectinload

    if current_user.role == RoleEnum.student:
        from backend.routes.tracking import recalculate_user_xp_and_streak
        # Automatically sync / recalculate the user's XP and level on profile query
        await recalculate_user_xp_and_streak(current_user.id, db)
        
        # Reload user to ensure relationships are loaded
        user_res = await db.execute(
            select(User).where(User.id == current_user.id)
            .options(
                selectinload(User.batch),
                selectinload(User.all_batches),
                selectinload(User.class_groups),
                selectinload(User.institute)
            )
        )
        current_user = user_res.scalars().first()

    else:
        # For teachers/admins, reload their relationships too to prevent missing greenlet on institute
        user_res = await db.execute(
            select(User).where(User.id == current_user.id)
            .options(
                selectinload(User.batch),
                selectinload(User.all_batches),
                selectinload(User.class_groups),
                selectinload(User.institute)
            )
        )
        current_user = user_res.scalars().first()

    return current_user

@router.put("/push-token")
async def update_push_token(request: __import__("backend.schemas.schemas", fromlist=["PushTokenRequest"]).PushTokenRequest, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    user_res = await db.execute(select(User).where(User.id == current_user.id))
    user = user_res.scalars().first()
    if user:
        user.expo_push_token = request.token
        await db.commit()
    return {"message": "Push token updated"}

from backend.models.models import Institute
from pydantic import BaseModel as _BaseModel
from typing import Optional as _Optional

class InstituteUpdate(_BaseModel):
    name: _Optional[str] = None
    logo_url: _Optional[str] = None

@router.patch("/institute", response_model=__import__("backend.schemas.schemas", fromlist=["InstituteOut"]).InstituteOut)
async def update_institute(data: InstituteUpdate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    """Allows an admin to update their institute's name and logo (used for white-label branding)."""
    from backend.models.models import RoleEnum
    if current_user.role != RoleEnum.admin:
        raise HTTPException(status_code=403, detail="Only admins can update institute info")

    # Fetch institute_id directly from DB to avoid lazy-load issues
    user_row = await db.execute(select(User.institute_id).where(User.id == current_user.id))
    institute_id = user_row.scalar_one_or_none()

    if not institute_id:
        raise HTTPException(status_code=404, detail="No institute linked to this user")

    result = await db.execute(select(Institute).where(Institute.id == institute_id))
    institute = result.scalars().first()
    if not institute:
        raise HTTPException(status_code=404, detail="Institute not found")

    if data.name is not None:
        institute.name = data.name.strip()
    if data.logo_url is not None:
        institute.logo_url = data.logo_url

    db.add(institute)
    await db.commit()
    await db.refresh(institute)
    return institute
