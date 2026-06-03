from sqlalchemy import Column, Integer, String, ForeignKey, Enum, DateTime, Boolean, Table, Float, Date, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from backend.database.database import Base
import enum

class RoleEnum(str, enum.Enum):
    student = "student"
    teacher = "teacher"
    admin = "admin"

class Institute(Base):
    __tablename__ = "institutes"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    logo_url = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    users = relationship("User", back_populates="institute")
    batches = relationship("Batch", back_populates="institute")

user_batches = Table(
    "user_batches",
    Base.metadata,
    Column("user_id", Integer, ForeignKey("users.id"), primary_key=True),
    Column("batch_id", Integer, ForeignKey("batches.id"), primary_key=True)
)

user_class_groups = Table(
    "user_class_groups",
    Base.metadata,
    Column("user_id", Integer, ForeignKey("users.id"), primary_key=True),
    Column("class_group_id", Integer, ForeignKey("class_groups.id"), primary_key=True)
)


class Batch(Base):
    __tablename__ = "batches"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    invite_code = Column(String, unique=True, index=True, nullable=True)
    invite_code_expires_at = Column(DateTime, nullable=True)
    teacher_invite_code = Column(String, unique=True, index=True, nullable=True)
    teacher_invite_code_expires_at = Column(DateTime, nullable=True)
    address = Column(String, nullable=True)
    logo_url = Column(String, nullable=True)
    teacher_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    institute_id = Column(Integer, ForeignKey("institutes.id"), nullable=True)
    
    teacher = relationship("User", foreign_keys=[teacher_id])
    institute = relationship("Institute", back_populates="batches")
    members = relationship("User", secondary=user_batches, back_populates="all_batches")
    notes = relationship("Note", back_populates="batch")
    folders = relationship("Folder", back_populates="batch")
    dpps = relationship("DPP", back_populates="batch")
    class_groups = relationship("ClassGroup", back_populates="batch", cascade="all, delete-orphan")

class ClassGroup(Base):
    __tablename__ = "class_groups"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=False)
    
    batch = relationship("Batch", back_populates="class_groups")
    members = relationship("User", secondary=user_class_groups, back_populates="class_groups")
    notes = relationship("Note", back_populates="class_group")
    folders = relationship("Folder", back_populates="class_group")
    dpps = relationship("DPP", back_populates="class_group")


class Folder(Base):
    __tablename__ = "folders"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=False)
    class_group_id = Column(Integer, ForeignKey("class_groups.id"), nullable=True)
    parent_id = Column(Integer, ForeignKey("folders.id"), nullable=True)
    folder_type = Column(String, nullable=False, default="notes", server_default="notes")
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    batch = relationship("Batch", back_populates="folders")
    class_group = relationship("ClassGroup", back_populates="folders")
    parent = relationship("Folder", remote_side=[id], back_populates="subfolders")
    subfolders = relationship("Folder", back_populates="parent", cascade="all, delete-orphan")
    notes = relationship("Note", back_populates="folder", cascade="all, delete-orphan")
    dpps = relationship("DPP", back_populates="folder", cascade="all, delete-orphan")


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password = Column(String, nullable=False)
    role = Column(Enum(RoleEnum), nullable=False)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=True)
    last_active = Column(DateTime, nullable=True)  # For online presence tracking
    current_action = Column(String, nullable=True)  # What the student is doing right now
    avatar_url = Column(String, nullable=True)
    xp = Column(Integer, default=0)
    level = Column(Integer, default=1)
    streak_count = Column(Integer, default=0)
    last_streak_date = Column(DateTime, nullable=True)
    coins = Column(Integer, default=0, server_default="0", nullable=False)
    xp_booster_expiry = Column(DateTime, nullable=True)
    xp_booster_multiplier = Column(Float, default=1.0, server_default="1.0", nullable=False)
    streak_freezers_owned = Column(Integer, default=0, server_default="0", nullable=False)
    streak_freezers_purchased = Column(Integer, default=0, server_default="0", nullable=False)
    expo_push_token = Column(String, nullable=True)
    inventory_boosters = Column(JSON, default=list, server_default="[]", nullable=False)
    institute_id = Column(Integer, ForeignKey("institutes.id"), nullable=True)
    
    batch = relationship("Batch", foreign_keys=[batch_id])
    institute = relationship("Institute", back_populates="users")
    all_batches = relationship("Batch", secondary=user_batches, back_populates="members")
    class_groups = relationship("ClassGroup", secondary=user_class_groups, back_populates="members")
    attempts = relationship("Attempt", back_populates="user")


class Note(Base):
    __tablename__ = "notes"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    file_url = Column(String, nullable=False)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=False)
    class_group_id = Column(Integer, ForeignKey("class_groups.id"), nullable=True)
    folder_id = Column(Integer, ForeignKey("folders.id"), nullable=True)
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    
    batch = relationship("Batch", back_populates="notes")
    class_group = relationship("ClassGroup", back_populates="notes")
    folder = relationship("Folder", back_populates="notes")
    uploader = relationship("User")
    completions = relationship("NoteCompletion", back_populates="note", cascade="all, delete-orphan")


class DPP(Base):
    __tablename__ = "dpps"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    file_url = Column(String, nullable=True) # Actual PDF/Image content
    total_questions = Column(Integer, nullable=True, default=0)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=False)
    class_group_id = Column(Integer, ForeignKey("class_groups.id"), nullable=True)
    folder_id = Column(Integer, ForeignKey("folders.id"), nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    batch = relationship("Batch", back_populates="dpps")
    class_group = relationship("ClassGroup", back_populates="dpps")
    folder = relationship("Folder", back_populates="dpps")
    creator = relationship("User")
    attempts = relationship("Attempt", back_populates="dpp", cascade="all, delete-orphan")
    questions = relationship("DPPQuestion", back_populates="dpp", cascade="all, delete-orphan")


class DPPQuestion(Base):
    __tablename__ = "dpp_questions"
    id = Column(Integer, primary_key=True, index=True)
    dpp_id = Column(Integer, ForeignKey("dpps.id", ondelete="CASCADE"), nullable=False)
    question_text = Column(String, nullable=False)
    question_type = Column(String, default="subjective") # "mcq" or "subjective"
    options = Column(String, nullable=True) # JSON-serialized list of strings or comma-separated options
    correct_option = Column(String, nullable=True) # e.g. "A", "B", "C", "D"

    dpp = relationship("DPP", back_populates="questions")


class Attempt(Base):
    __tablename__ = "attempts"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    dpp_id = Column(Integer, ForeignKey("dpps.id"), nullable=False)
    questions_attempted = Column(Integer, default=0)
    correct_questions = Column(Integer, default=0)
    time_spent = Column(Integer, default=0) # in seconds
    completed = Column(Boolean, default=False)
    submitted_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", back_populates="attempts")
    dpp = relationship("DPP", back_populates="attempts")

class StreakFreeze(Base):
    __tablename__ = "streak_freezes"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    freeze_date = Column(Date, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User")

class NoteCompletion(Base):
    __tablename__ = "note_completions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    note_id = Column(Integer, ForeignKey("notes.id"), nullable=False)
    completed_at = Column(DateTime, default=datetime.utcnow)
    is_completed = Column(Boolean, default=False, server_default="false", nullable=False)
    time_spent = Column(Integer, default=0, server_default="0", nullable=False)

    user = relationship("User")
    note = relationship("Note", back_populates="completions")


class Message(Base):
    __tablename__ = "messages"
    id = Column(Integer, primary_key=True, index=True)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    receiver_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=False)
    content = Column(String, nullable=False)
    subject = Column(String, nullable=True)
    image_url = Column(String, nullable=True)
    audio_url = Column(String, nullable=True)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    sender = relationship("User", foreign_keys=[sender_id])
    receiver = relationship("User", foreign_keys=[receiver_id])
    batch = relationship("Batch")


class UserBooster(Base):
    __tablename__ = "user_boosters"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    start_time = Column(DateTime, nullable=False, default=datetime.utcnow)
    end_time = Column(DateTime, nullable=False)
    multiplier = Column(Float, default=2.0, nullable=False)
    coin_cost = Column(Integer, default=0, server_default="0", nullable=False)

    user = relationship("User")


class UserChestClaim(Base):
    __tablename__ = "user_chest_claims"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    chest_type = Column(String, nullable=False)
    coins_rewarded = Column(Integer, default=0, nullable=False)
    booster_rewarded_type = Column(String, nullable=True)
    claimed_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    user = relationship("User")
