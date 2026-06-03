from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional, List
from datetime import datetime
from backend.models.models import RoleEnum

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: RoleEnum
    batch_id: Optional[int] = None
    institute_id: Optional[int] = None

    @field_validator("name")
    @classmethod
    def name_must_be_valid(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2:
            raise ValueError("Name must be at least 2 characters long.")
        if len(v) > 100:
            raise ValueError("Name must not exceed 100 characters.")
        return v

    @field_validator("password")
    @classmethod
    def password_must_be_strong(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long.")
        if len(v) > 128:
            raise ValueError("Password must not exceed 128 characters.")
        return v

class InstituteOut(BaseModel):
    id: int
    name: str
    logo_url: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        orm_mode = True
        from_attributes = True

class BatchOut(BaseModel):
    id: int
    name: str
    invite_code: Optional[str] = None
    invite_code_expires_at: Optional[datetime] = None
    teacher_invite_code: Optional[str] = None
    teacher_invite_code_expires_at: Optional[datetime] = None
    address: Optional[str] = None
    logo_url: Optional[str] = None
    teacher_id: Optional[int]
    institute_id: Optional[int] = None
    institute: Optional[InstituteOut] = None

    class Config:
        orm_mode = True
        from_attributes = True

class BatchCreate(BaseModel):
    name: str
    address: Optional[str] = None
    logo_url: Optional[str] = None
    teacher_id: Optional[int] = None

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None
    role: Optional[RoleEnum] = None

class ClassGroupCreate(BaseModel):
    name: str

class PushTokenRequest(BaseModel):
    token: str

class ClassGroupOut(BaseModel):
    id: int
    name: str
    batch_id: int
    member_count: Optional[int] = 0

    class Config:
        orm_mode = True
        from_attributes = True

class UserOut(BaseModel):
    id: int
    name: str
    email: EmailStr
    role: RoleEnum
    batch_id: Optional[int]
    expo_push_token: Optional[str] = None
    avatar_url: Optional[str] = None
    xp: int = 0
    level: int = 1
    streak_count: int = 0
    last_streak_date: Optional[datetime] = None
    coins: int = 0
    xp_booster_expiry: Optional[datetime] = None
    xp_booster_multiplier: float = 1.0
    inventory_boosters: list = []
    institute_id: Optional[int] = None
    institute: Optional[InstituteOut] = None
    batch: Optional[BatchOut] = None
    all_batches: List[BatchOut] = []
    class_groups: List[ClassGroupOut] = []

    class Config:
        orm_mode = True
        from_attributes = True

class FolderCreate(BaseModel):
    name: str
    batch_id: int
    class_group_id: Optional[int] = None
    parent_id: Optional[int] = None
    folder_type: Optional[str] = "notes"

class FolderOut(BaseModel):
    id: int
    name: str
    batch_id: int
    class_group_id: Optional[int] = None
    parent_id: Optional[int] = None
    folder_type: str
    created_by: int
    created_at: datetime

    class Config:
        orm_mode = True
        from_attributes = True

class NoteCreate(BaseModel):
    title: str
    file_url: str
    batch_id: int
    folder_id: Optional[int] = None
    class_group_id: Optional[int] = None

class NoteOut(BaseModel):
    id: int
    title: str
    file_url: str
    batch_id: int
    class_group_id: Optional[int] = None
    folder_id: Optional[int]
    uploaded_by: int
    uploaded_at: datetime

    class Config:
        orm_mode = True
        from_attributes = True

class DPPQuestionCreate(BaseModel):
    question_text: str
    question_type: str # "mcq" or "subjective"
    options: Optional[str] = None # JSON string
    correct_option: Optional[str] = None # "A", "B", "C", "D"

class DPPQuestionOut(BaseModel):
    id: int
    dpp_id: int
    question_text: str
    question_type: str
    options: Optional[str] = None
    correct_option: Optional[str] = None

    class Config:
        orm_mode = True
        from_attributes = True

class AttemptCreate(BaseModel):
    dpp_id: int
    questions_attempted: int
    correct_questions: Optional[int] = 0
    time_spent: int
    completed: bool

class AttemptOut(BaseModel):
    id: int
    user_id: int
    dpp_id: int
    questions_attempted: int
    correct_questions: Optional[int] = 0
    time_spent: int
    completed: bool
    submitted_at: datetime

    class Config:
        orm_mode = True
        from_attributes = True

class DPPCreate(BaseModel):
    title: str
    file_url: Optional[str] = None
    total_questions: int = 0
    batch_id: int
    class_group_id: Optional[int] = None
    folder_id: Optional[int] = None
    questions: Optional[List[DPPQuestionCreate]] = []

class DPPOut(BaseModel):
    id: int
    title: str
    file_url: Optional[str] = None
    total_questions: int = 0
    batch_id: int
    class_group_id: Optional[int] = None
    folder_id: Optional[int] = None
    created_by: int
    questions: List[DPPQuestionOut] = []
    user_attempt: Optional[AttemptOut] = None

    class Config:
        orm_mode = True
        from_attributes = True


class ChestStatusOut(BaseModel):
    chest_type: str
    label: str
    status: str  # "locked", "ready_to_claim", "claimed"
    progress: int
    target: int


class ChestsStatusResponse(BaseModel):
    chests: List[ChestStatusOut]
    weekly_activity_count: int


class ClaimChestRequest(BaseModel):
    chest_type: str


class ClaimChestResponse(BaseModel):
    success: bool
    chest_type: str
    coins_rewarded: int
    booster_rewarded_type: Optional[str] = None
    booster_expiry: Optional[datetime] = None
    user: UserOut

    class Config:
        orm_mode = True
        from_attributes = True

