import os
import bcrypt
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from fastapi.security import OAuth2PasswordBearer
from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from dotenv import load_dotenv

load_dotenv(override=True)

from backend.database.database import get_db
from backend.models.models import User, RoleEnum
from backend.schemas.schemas import TokenData

# Load from environment — MUST be set to a strong random value in production.
# Generate one with: python -c "import secrets; print(secrets.token_hex(32))"
SECRET_KEY = os.environ.get("SECRET_KEY", "INSECURE_DEV_KEY_CHANGE_BEFORE_DEPLOY")
if SECRET_KEY == "INSECURE_DEV_KEY_CHANGE_BEFORE_DEPLOY":
    import warnings
    warnings.warn(
        "⚠️  SECRET_KEY is not set! Using insecure dev key. "
        "Set SECRET_KEY in your .env before deploying.",
        stacklevel=2
    )

ALGORITHM = "HS256"
# 30 days default for mobile app persistent login
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.environ.get("ACCESS_TOKEN_EXPIRE_MINUTES", "43200"))

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

def verify_password(plain_password, hashed_password):
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def get_password_hash(password):
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        role: str = payload.get("role")
        if email is None:
            raise credentials_exception
        token_data = TokenData(email=email, role=role)
    except JWTError:
        raise credentials_exception
    
    from sqlalchemy.orm import selectinload
    result = await db.execute(select(User).options(
        selectinload(User.batch),
        selectinload(User.all_batches),
        selectinload(User.class_groups),
        selectinload(User.institute)
    ).where(User.email == token_data.email))
    user = result.scalars().first()
    
    if user and user.batch_id and user.batch:
        if user.batch not in user.all_batches:
            user.all_batches.append(user.batch)
            db.add(user)
            await db.commit()
            await db.refresh(user)
            
    if user is None:
        raise credentials_exception
    return user

async def get_current_active_user(current_user: User = Depends(get_current_user)):
    return current_user

def check_batch_access(current_user: User, batch_id: int):
    """
    Verify that the user has permission to access or modify data for the given batch_id.
    Prevents cross-tenant data leakage.
    """
    if current_user.role in [RoleEnum.admin, RoleEnum.teacher]:
        allowed_batch_ids = [b.id for b in current_user.all_batches]
        if current_user.batch_id and current_user.batch_id not in allowed_batch_ids:
            allowed_batch_ids.append(current_user.batch_id)
        if batch_id not in allowed_batch_ids:
            raise HTTPException(status_code=403, detail="Access denied. You do not belong to this coaching group.")
    else:
        # Students can only access their primary batch
        if current_user.batch_id != batch_id:
            raise HTTPException(status_code=403, detail="Access denied")
