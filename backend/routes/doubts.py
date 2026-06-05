from fastapi import APIRouter, Depends, HTTPException, File, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import and_, or_, desc, func, delete
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel
import uuid
import os

from backend.database.database import get_db
from backend.models.models import Message, User, RoleEnum, Batch, ClassGroup, user_class_groups, user_batches
from backend.services.security import get_current_active_user
from backend.services.upload_validation import (
    validate_upload,
    ALLOWED_IMAGE_EXTS, ALLOWED_IMAGE_MIMES,
    ALLOWED_AUDIO_EXTS, ALLOWED_AUDIO_MIMES,
    MAX_IMAGE_SIZE_MB, MAX_AUDIO_SIZE_MB,
)

from backend.services.storage import upload_file_to_supabase, delete_file_from_supabase

router = APIRouter(prefix="/doubts", tags=["doubts"])


class MessageCreate(BaseModel):
    receiver_id: int
    content: str
    subject: Optional[str] = None
    image_url: Optional[str] = None
    audio_url: Optional[str] = None


class MessageOut(BaseModel):
    id: int
    sender_id: int
    receiver_id: int
    batch_id: int
    content: str
    subject: Optional[str] = None
    image_url: Optional[str] = None
    audio_url: Optional[str] = None
    is_read: bool
    created_at: datetime
    sender_name: Optional[str] = None
    sender_role: Optional[str] = None
    receiver_name: Optional[str] = None

    class Config:
        orm_mode = True


class ConversationOut(BaseModel):
    user_id: int
    user_name: str
    user_role: str
    avatar_url: Optional[str] = None
    class_group_name: Optional[str] = None
    last_message: str
    last_message_at: datetime
    unread_count: int
    is_online: bool


@router.post("/send", response_model=MessageOut)
async def send_message(
    msg: MessageCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Send a doubt/message to a teacher or reply to a student."""
    if not current_user.batch_id:
        raise HTTPException(status_code=400, detail="You must be in a coaching group to send messages")

    # Verify receiver exists and is in the same batch
    receiver_res = await db.execute(select(User).where(User.id == msg.receiver_id))
    receiver = receiver_res.scalars().first()
    if not receiver:
        raise HTTPException(status_code=404, detail="Receiver not found")

    # Students can only message teachers/admins; Teachers/Admins can reply to students
    if current_user.role == RoleEnum.student:
        if receiver.role not in [RoleEnum.teacher, RoleEnum.admin]:
            raise HTTPException(status_code=403, detail="Students can only message teachers")
    elif current_user.role in [RoleEnum.teacher, RoleEnum.admin]:
        if receiver.role != RoleEnum.student:
            raise HTTPException(status_code=403, detail="Teachers can only reply to students")

    new_message = Message(
        sender_id=current_user.id,
        receiver_id=msg.receiver_id,
        batch_id=current_user.batch_id,
        content=msg.content.strip(),
        subject=msg.subject.strip() if msg.subject else None,
        image_url=msg.image_url,
        audio_url=msg.audio_url,
    )
    db.add(new_message)
    await db.commit()
    await db.refresh(new_message)

    return MessageOut(
        id=new_message.id,
        sender_id=new_message.sender_id,
        receiver_id=new_message.receiver_id,
        batch_id=new_message.batch_id,
        content=new_message.content,
        subject=new_message.subject,
        image_url=new_message.image_url,
        audio_url=new_message.audio_url,
        is_read=new_message.is_read,
        created_at=new_message.created_at,
        sender_name=current_user.name,
        sender_role=current_user.role.value,
        receiver_name=receiver.name,
    )


@router.get("/conversations", response_model=List[ConversationOut])
async def get_conversations(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get list of conversation threads for the current user."""
    if not current_user.batch_id:
        return []

    # Get all messages where current user is sender or receiver
    messages_res = await db.execute(
        select(Message).where(
            and_(
                Message.batch_id == current_user.batch_id,
                or_(
                    Message.sender_id == current_user.id,
                    Message.receiver_id == current_user.id
                )
            )
        ).order_by(desc(Message.created_at))
    )
    messages = messages_res.scalars().all()

    # Group by the "other" user
    conversations = {}
    for msg in messages:
        other_id = msg.receiver_id if msg.sender_id == current_user.id else msg.sender_id
        if other_id not in conversations:
            conversations[other_id] = {
                "last_message": (
                    "🎙️ Voice Message" if msg.audio_url
                    else "Photo" if msg.image_url and (not msg.content or not msg.content.strip() or msg.content.strip() in ['📷', 'Photo'])
                    else msg.content or ""
                ),
                "last_message_at": msg.created_at,
                "unread_count": 0,
            }
        # Count unread messages sent TO the current user
        if msg.receiver_id == current_user.id and not msg.is_read:
            conversations[other_id]["unread_count"] += 1

    # Fetch user details for conversation partners
    if not conversations:
        return []

    users_res = await db.execute(
        select(User).where(User.id.in_(list(conversations.keys())))
    )
    users = {u.id: u for u in users_res.scalars().all()}

    # Fetch class group names for all conversation partners
    class_group_map = {}
    user_ids = list(conversations.keys())
    if user_ids:
        cg_res = await db.execute(
            select(user_class_groups.c.user_id, ClassGroup.name)
            .join(ClassGroup, ClassGroup.id == user_class_groups.c.class_group_id)
            .where(user_class_groups.c.user_id.in_(user_ids))
        )
        for uid, cg_name in cg_res.all():
            class_group_map[uid] = cg_name

    result = []
    for user_id, conv in conversations.items():
        user = users.get(user_id)
        if user:
            result.append(ConversationOut(
                user_id=user.id,
                user_name=user.name,
                user_role=user.role.value,
                avatar_url=user.avatar_url,
                class_group_name=class_group_map.get(user.id),
                last_message=conv["last_message"][:80],
                last_message_at=conv["last_message_at"],
                unread_count=conv["unread_count"],
                is_online=user.last_active and (datetime.utcnow() - user.last_active).total_seconds() < 300,
            ))

    # Sort by last message time
    result.sort(key=lambda c: c.last_message_at, reverse=True)
    return result


@router.get("/messages/{other_user_id}", response_model=List[MessageOut])
async def get_messages(
    other_user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get all messages in a conversation with another user."""
    if not current_user.batch_id:
        return []

    messages_res = await db.execute(
        select(Message).where(
            and_(
                Message.batch_id == current_user.batch_id,
                or_(
                    and_(Message.sender_id == current_user.id, Message.receiver_id == other_user_id),
                    and_(Message.sender_id == other_user_id, Message.receiver_id == current_user.id),
                )
            )
        ).order_by(Message.created_at)
    )
    messages = messages_res.scalars().all()

    # Mark received messages as read
    for msg in messages:
        if msg.receiver_id == current_user.id and not msg.is_read:
            msg.is_read = True
            db.add(msg)
    await db.commit()

    # Fetch user names
    user_ids = set()
    for msg in messages:
        user_ids.add(msg.sender_id)
        user_ids.add(msg.receiver_id)

    users_res = await db.execute(select(User).where(User.id.in_(list(user_ids))))
    users = {u.id: u for u in users_res.scalars().all()}

    return [
        MessageOut(
            id=msg.id,
            sender_id=msg.sender_id,
            receiver_id=msg.receiver_id,
            batch_id=msg.batch_id,
            content=msg.content,
            subject=msg.subject,
            image_url=msg.image_url,
            audio_url=msg.audio_url,
            is_read=msg.is_read,
            created_at=msg.created_at,
            sender_name=users.get(msg.sender_id, {}).name if users.get(msg.sender_id) else None,
            sender_role=users.get(msg.sender_id).role.value if users.get(msg.sender_id) else None,
            receiver_name=users.get(msg.receiver_id).name if users.get(msg.receiver_id) else None,
        )
        for msg in messages
    ]


@router.get("/teachers", response_model=list)
async def get_available_teachers(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get teachers/admins in the student's batch for starting a new conversation."""
    if not current_user.batch_id:
        return []

    if current_user.role != RoleEnum.student:
        raise HTTPException(status_code=403, detail="This endpoint is for students only")

    # Get the batch info
    batch_res = await db.execute(select(Batch).where(Batch.id == current_user.batch_id))
    batch = batch_res.scalars().first()

    # Find teachers/admins in this batch
    teachers_res = await db.execute(
        select(User).where(
            and_(
                User.role.in_([RoleEnum.teacher, RoleEnum.admin]),
                or_(
                    User.batch_id == current_user.batch_id,
                    User.id.in_(select(user_batches.c.user_id).where(user_batches.c.batch_id == current_user.batch_id))
                )
            )
        )
    )
    teachers = teachers_res.scalars().all()

    return [
        {
            "id": t.id,
            "name": t.name,
            "role": t.role.value,
            "avatar_url": t.avatar_url,
            "is_online": t.last_active and (datetime.utcnow() - t.last_active).total_seconds() < 300,
        }
        for t in teachers
    ]


@router.get("/unread-count")
async def get_unread_count(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get total unread message count for the current user."""
    if not current_user.batch_id:
        return {"unread_count": 0}

    count_res = await db.execute(
        select(func.count(Message.id)).where(
            and_(
                Message.receiver_id == current_user.id,
                Message.batch_id == current_user.batch_id,
                Message.is_read == False
            )
        )
    )
    count = count_res.scalar() or 0
    return {"unread_count": count}


@router.post("/upload-image")
async def upload_chat_image(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user)
):
    """Upload an image for use in a chat message. Max 10 MB."""
    if not current_user.batch_id:
        raise HTTPException(status_code=400, detail="You must be in a coaching group")

    content = await validate_upload(
        file,
        allowed_exts=ALLOWED_IMAGE_EXTS,
        allowed_mimes=ALLOWED_IMAGE_MIMES,
        max_mb=MAX_IMAGE_SIZE_MB,
        label="Image",
    )
    public_url = await upload_file_to_supabase(
        content, 
        file.filename or "chat_image.jpg", 
        file.content_type or "image/jpeg"
    )

    return {"image_url": public_url}

@router.post("/upload-audio")
async def upload_chat_audio(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user)
):
    """Upload an audio file for use in a chat message. Max 5 MB."""
    if not current_user.batch_id:
        raise HTTPException(status_code=400, detail="You must be in a coaching group")

    content = await validate_upload(
        file,
        allowed_exts=ALLOWED_AUDIO_EXTS,
        allowed_mimes=ALLOWED_AUDIO_MIMES,
        max_mb=MAX_AUDIO_SIZE_MB,
        label="Audio",
    )
    public_url = await upload_file_to_supabase(
        content, 
        file.filename or "chat_audio.m4a", 
        file.content_type or "audio/m4a"
    )

    return {"audio_url": public_url}

@router.delete("/conversations/{other_user_id}")
async def delete_conversation(
    other_user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Delete all messages between current user and other_user_id."""
    if not current_user.batch_id:
        raise HTTPException(status_code=400, detail="User not in a batch")

    # Delete all messages between current_user and other_user_id
    # Find all messages to delete their files
    messages_res = await db.execute(
        select(Message).where(
            or_(
                and_(Message.sender_id == current_user.id, Message.receiver_id == other_user_id),
                and_(Message.sender_id == other_user_id, Message.receiver_id == current_user.id)
            )
        )
    )
    for msg in messages_res.scalars().all():
        if msg.image_url:
            await delete_file_from_supabase(msg.image_url)
        if msg.audio_url:
            await delete_file_from_supabase(msg.audio_url)
        await db.delete(msg)
        
    await db.commit()
    return {"message": "Conversation deleted successfully"}
