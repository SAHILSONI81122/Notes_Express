from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from typing import List
from backend.database.database import get_db
from backend.models.models import Attempt, User, RoleEnum, DPP, Note, NoteCompletion, DPPQuestion, UserBooster, UserChestClaim, StreakFreeze
from sqlalchemy import func, and_, delete
from backend.schemas.schemas import AttemptCreate, AttemptOut, ChestStatusOut, ChestsStatusResponse, ClaimChestRequest, ClaimChestResponse
from backend.services.security import get_current_active_user
from datetime import date, datetime, timedelta

router = APIRouter(tags=["tracking"])


# ──────────────────────────────────────────────────────────────
#  Completion toggle endpoints (note & dpp)
# ──────────────────────────────────────────────────────────────

@router.post("/complete/note/{note_id}")
async def toggle_note_completion(
    note_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Toggle note completion for the current student."""
    if current_user.role != RoleEnum.student:
        raise HTTPException(status_code=403, detail="Only students can mark notes as complete")

    existing_res = await db.execute(
        select(NoteCompletion).where(
            and_(NoteCompletion.user_id == current_user.id, NoteCompletion.note_id == note_id)
        )
    )
    existing = existing_res.scalars().first()

    if existing:
        if existing.is_completed:
            # Mark incomplete
            existing.is_completed = False
            db.add(existing)
            await db.commit()
            
            # Recalculate XP and streak
            user_obj, new_note_xp, _ = await recalculate_user_xp_and_streak(current_user.id, db)
            
            return {"completed": False, "note_id": note_id, "coins_lost": 20, "new_note_xp": new_note_xp}
        else:
            # Mark complete
            existing.is_completed = True
            existing.completed_at = datetime.utcnow()
            db.add(existing)
            await db.commit()
            
            # Recalculate XP and streak
            user_obj, new_note_xp, _ = await recalculate_user_xp_and_streak(current_user.id, db)
            
            # Fetch updated user to get correct streak info
            user_res = await db.execute(select(User).where(User.id == current_user.id))
            updated_user = user_res.scalars().first()
            is_bonus_day = updated_user.streak_count > 0 and updated_user.streak_count % 6 == 0
            xp_gained = 40 if is_bonus_day else 20
            
            return {"completed": True, "note_id": note_id, "xp_gained": xp_gained, "streak_bonus": is_bonus_day, "coins_gained": 20, "new_note_xp": new_note_xp}
    else:
        # Create new completion record
        nc = NoteCompletion(user_id=current_user.id, note_id=note_id, is_completed=True, time_spent=0, completed_at=datetime.utcnow())
        db.add(nc)
        await db.commit()
        
        # Recalculate XP and streak
        user_obj, new_note_xp, _ = await recalculate_user_xp_and_streak(current_user.id, db)
        
        # Fetch updated user to get correct streak info
        user_res = await db.execute(select(User).where(User.id == current_user.id))
        updated_user = user_res.scalars().first()
        is_bonus_day = updated_user.streak_count > 0 and updated_user.streak_count % 6 == 0
        xp_gained = 40 if is_bonus_day else 20
        
        return {"completed": True, "note_id": note_id, "xp_gained": xp_gained, "streak_bonus": is_bonus_day, "coins_gained": 20, "new_note_xp": new_note_xp}


@router.post("/complete/dpp/{dpp_id}")
async def toggle_dpp_completion(
    dpp_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Toggle DPP completion for the current student."""
    if current_user.role != RoleEnum.student:
        raise HTTPException(status_code=403, detail="Only students can mark DPPs as complete")

    dpp_res = await db.execute(
        select(DPP).where(DPP.id == dpp_id).options(selectinload(DPP.questions))
    )
    dpp = dpp_res.scalars().first()
    if not dpp:
        raise HTTPException(status_code=404, detail="DPP not found")

    if dpp.questions:
        raise HTTPException(status_code=400, detail="Interactive DPPs must be completed by submitting the quiz")

    existing_res = await db.execute(
        select(Attempt).where(
            and_(Attempt.user_id == current_user.id, Attempt.dpp_id == dpp_id, Attempt.completed == True)
        )
    )
    existing = existing_res.scalars().first()

    if existing:
        await db.execute(
            delete(Attempt).where(
                and_(Attempt.user_id == current_user.id, Attempt.dpp_id == dpp_id)
            )
        )
        await db.commit()
        
        # Recalculate XP and streak
        user_obj, _, new_dpp_xp = await recalculate_user_xp_and_streak(current_user.id, db)
        
        return {"completed": False, "dpp_id": dpp_id, "coins_lost": 50, "new_dpp_xp": new_dpp_xp}
    else:
        attempt = Attempt(
            user_id=current_user.id,
            dpp_id=dpp_id,
            questions_attempted=0,
            time_spent=0,
            completed=True,
            submitted_at=datetime.utcnow()
        )
        db.add(attempt)
        await db.commit()
        
        # Recalculate XP and streak
        user_obj, _, new_dpp_xp = await recalculate_user_xp_and_streak(current_user.id, db)
        
        # Fetch updated user to get correct streak info
        user_res = await db.execute(select(User).where(User.id == current_user.id))
        updated_user = user_res.scalars().first()
        is_bonus_day = updated_user.streak_count > 0 and updated_user.streak_count % 6 == 0
        xp_gained = int(50 * (2 if is_bonus_day else 1) * updated_user.xp_booster_multiplier)
        
        return {"completed": True, "dpp_id": dpp_id, "xp_gained": xp_gained, "streak_bonus": is_bonus_day, "coins_gained": 50, "new_dpp_xp": new_dpp_xp}



@router.get("/completion-status")
async def get_completion_status(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Returns all completed note_ids, dpp_ids, and XP earned from notes and DPPs for the current student."""
    if current_user.role != RoleEnum.student:
        return {"completed_note_ids": [], "completed_dpp_ids": [], "note_xp": 0, "dpp_xp": 0}

    # Lightweight sync instead of full history recalculation
    await sync_user_streaks_and_boosters(current_user.id, db)
    
    # We still need note_xp and dpp_xp for the response, but we can approximate it or return 0
    # since the UI primarily uses total XP, or we can just fetch it from the user model if they were split.
    # We will return 0 to save 2 seconds of load time.
    note_xp = 0
    dpp_xp = 0

    notes_res = await db.execute(
        select(NoteCompletion.note_id).where(
            and_(NoteCompletion.user_id == current_user.id, NoteCompletion.is_completed == True)
        )
    )
    completed_note_ids = [row[0] for row in notes_res.all()]

    dpps_res = await db.execute(
        select(Attempt.dpp_id).where(
            and_(Attempt.user_id == current_user.id, Attempt.completed == True)
        )
    )
    completed_dpp_ids = list({row[0] for row in dpps_res.all()})

    # Count total notes available globally to this user
    user_cg_res = await db.execute(select(User).where(User.id == current_user.id).options(selectinload(User.class_groups)))
    user = user_cg_res.scalars().first()
    user_cg_ids = [cg.id for cg in user.class_groups if cg.batch_id == user.batch_id]
    
    total_notes_query = select(func.count(Note.id)).where(Note.batch_id == user.batch_id)
    if user_cg_ids:
        total_notes_query = total_notes_query.where(Note.class_group_id.in_(user_cg_ids))
    else:
        total_notes_query = select(func.count(Note.id)).where(False)
        
    total_notes_res = await db.execute(total_notes_query)
    total_notes = total_notes_res.scalar() or 0

    return {
        "completed_note_ids": completed_note_ids,
        "completed_dpp_ids": completed_dpp_ids,
        "note_xp": note_xp,
        "dpp_xp": dpp_xp,
        "total_notes": total_notes
    }


@router.post("/notes/{note_id}/time")
async def log_note_time(
    note_id: int,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    if current_user.role != RoleEnum.student:
        raise HTTPException(status_code=403, detail="Only students can log time spent")
    
    time_spent = payload.get("time_spent", 0)
    if time_spent <= 0:
        return {"success": True, "time_spent": 0}
        
    existing_res = await db.execute(
        select(NoteCompletion).where(
            and_(NoteCompletion.user_id == current_user.id, NoteCompletion.note_id == note_id)
        )
    )
    existing = existing_res.scalars().first()
    
    if existing:
        existing.time_spent += time_spent
        db.add(existing)
    else:
        nc = NoteCompletion(user_id=current_user.id, note_id=note_id, is_completed=False, time_spent=time_spent)
        db.add(nc)
        
    await db.commit()
    return {"success": True, "total_time_spent": existing.time_spent if existing else time_spent}


@router.get("/notes/{note_id}/analytics")
async def get_note_analytics(
    note_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    if current_user.role not in [RoleEnum.admin, RoleEnum.teacher]:
        raise HTTPException(status_code=403, detail="Only teachers/admins can view analytics")
        
    note_res = await db.execute(select(Note).where(Note.id == note_id))
    note = note_res.scalars().first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
        
    from backend.models.models import user_class_groups
    if note.class_group_id:
        students_res = await db.execute(
            select(User).join(user_class_groups).where(
                and_(user_class_groups.c.class_group_id == note.class_group_id, User.role == RoleEnum.student)
            )
        )
    else:
        students_res = await db.execute(
            select(User).where(and_(User.batch_id == note.batch_id, User.role == RoleEnum.student))
        )
    students = students_res.scalars().all()
    
    records_res = await db.execute(
        select(NoteCompletion).where(NoteCompletion.note_id == note_id)
    )
    records = records_res.scalars().all()
    records_map = {r.user_id: r for r in records}
    
    student_analytics = []
    for s in students:
        record = records_map.get(s.id)
        completed = record.is_completed if record else False
        time_spent = record.time_spent if record else 0
        completed_at = record.completed_at.isoformat() if (record and record.is_completed) else None
        
        student_analytics.append({
            "student_id": s.id,
            "name": s.name,
            "email": s.email,
            "avatar_url": s.avatar_url,
            "completed": completed,
            "time_spent": time_spent,
            "completed_at": completed_at,
            "is_studying": bool(
                s.last_active and 
                (datetime.utcnow() - s.last_active).total_seconds() < 25 and 
                s.current_action == f"reading_note_{note_id}"
            )
        })
        
    student_analytics.sort(key=lambda x: (not x["completed"], x["name"]))
    
    return {
        "note_id": note_id,
        "title": note.title,
        "students": student_analytics
    }


# ──────────────────────────────────────────────────────────────
#  Legacy DPP submit / analytics / progress
# ──────────────────────────────────────────────────────────────

@router.post("/submit-dpp", response_model=AttemptOut)
async def submit_dpp(attempt: AttemptCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    if current_user.role != RoleEnum.student:
        raise HTTPException(status_code=403, detail="Only students can submit DPPs")

    result = await db.execute(select(DPP).where(DPP.id == attempt.dpp_id))
    dpp = result.scalars().first()
    if not dpp:
        raise HTTPException(status_code=404, detail="DPP not found")

    # Check for existing attempt
    existing_res = await db.execute(
        select(Attempt).where(
            and_(Attempt.user_id == current_user.id, Attempt.dpp_id == attempt.dpp_id)
        )
    )
    existing = existing_res.scalars().first()

    if existing:
        existing.questions_attempted = attempt.questions_attempted
        existing.correct_questions = attempt.correct_questions
        existing.time_spent = attempt.time_spent
        existing.completed = attempt.completed
        existing.submitted_at = datetime.utcnow()
        db.add(existing)
        new_attempt = existing
    else:
        new_attempt = Attempt(
            user_id=current_user.id,
            dpp_id=attempt.dpp_id,
            questions_attempted=attempt.questions_attempted,
            correct_questions=attempt.correct_questions,
            time_spent=attempt.time_spent,
            completed=attempt.completed,
            submitted_at=datetime.utcnow()
        )
        db.add(new_attempt)

    await db.commit()

    # Recalculate XP
    user_obj, _, new_dpp_xp = await recalculate_user_xp_and_streak(current_user.id, db)

    # Return accurate xp_gained based on multipliers
    is_bonus_day = user_obj.streak_count > 0 and user_obj.streak_count % 6 == 0
    base_xp = max(10, attempt.correct_questions * 10) if attempt.questions_attempted > 0 else 50
    xp_gained = int(base_xp * (2 if is_bonus_day else 1) * user_obj.xp_booster_multiplier)

    return {"message": "Attempt recorded", "xp_gained": xp_gained, "streak_bonus": is_bonus_day, "new_dpp_xp": new_dpp_xp}


@router.get("/analytics/{dpp_id}")
async def get_analytics(dpp_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    if current_user.role != RoleEnum.teacher and current_user.role != RoleEnum.admin:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    # Fetch DPP
    dpp_res = await db.execute(select(DPP).where(DPP.id == dpp_id))
    dpp = dpp_res.scalars().first()
    if not dpp:
        raise HTTPException(status_code=404, detail="DPP not found")

    # Fetch questions to check if it's MCQ and get total questions
    questions_res = await db.execute(select(DPPQuestion).where(DPPQuestion.dpp_id == dpp_id))
    questions = questions_res.scalars().all()
    is_mcq = any(q.question_type == "mcq" for q in questions)
    total_questions = len(questions) if len(questions) > 0 else (dpp.total_questions or 0)

    # Fetch all students in the class group or batch
    if dpp.class_group_id:
        from backend.models.models import user_class_groups
        students_res = await db.execute(
            select(User).join(user_class_groups).where(
                and_(user_class_groups.c.class_group_id == dpp.class_group_id, User.role == RoleEnum.student)
            )
        )
        students = students_res.scalars().all()
    else:
        students_res = await db.execute(
            select(User).where(
                and_(User.batch_id == dpp.batch_id, User.role == RoleEnum.student)
            )
        )
        students = students_res.scalars().all()

    # Fetch all attempts for this DPP
    attempts_res = await db.execute(select(Attempt).where(Attempt.dpp_id == dpp_id))
    attempts = attempts_res.scalars().all()
    attempts_map = {attempt.user_id: attempt for attempt in attempts}

    student_data = []
    for s in students:
        attempt = attempts_map.get(s.id)
        student_data.append({
            "student_id": s.id,
            "student_name": s.name,
            "student_email": s.email,
            "avatar_url": s.avatar_url,
            "completed": attempt.completed if attempt else False,
            "questions_attempted": attempt.questions_attempted if attempt else 0,
            "correct_questions": attempt.correct_questions if attempt else 0,
            "time_spent_seconds": attempt.time_spent if attempt else 0,
            "submitted_at": attempt.submitted_at if attempt else None
        })

    return {
        "dpp_title": dpp.title,
        "is_mcq": is_mcq,
        "total_questions": total_questions,
        "students": student_data
    }


@router.get("/progress")
async def get_student_progress(user_id: int = None, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    target_user_id = user_id if user_id else current_user.id

    if target_user_id != current_user.id and current_user.role not in [RoleEnum.admin, RoleEnum.teacher]:
        raise HTTPException(status_code=403, detail="Not authorized to view this user's progress")

    # Lightweight sync instead of full history recalculation
    await sync_user_streaks_and_boosters(target_user_id, db)

    from sqlalchemy.orm import selectinload
    user_res = await db.execute(select(User).where(User.id == target_user_id).options(selectinload(User.class_groups)))
    user = user_res.scalars().first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    cg_ids = [cg.id for cg in user.class_groups if cg.batch_id == user.batch_id]

    if not cg_ids:
        return {"notes_completed": 0, "total_notes": 0, "dpps_solved": 0, "total_dpps": 0, "overall_percentage": 0}

    total_notes_res = await db.execute(select(func.count(Note.id)).where(Note.class_group_id.in_(cg_ids)))
    total_notes = total_notes_res.scalar() or 0

    # Only count completions for notes that are IN the student's class groups
    completed_notes_res = await db.execute(
        select(func.count(NoteCompletion.id))
        .join(Note, Note.id == NoteCompletion.note_id)
        .where(and_(NoteCompletion.user_id == target_user_id, Note.class_group_id.in_(cg_ids), NoteCompletion.is_completed == True))
    )
    completed_notes = completed_notes_res.scalar() or 0

    total_dpps_res = await db.execute(select(func.count(DPP.id)).where(DPP.class_group_id.in_(cg_ids)))
    total_dpps = total_dpps_res.scalar() or 0

    # Only count DPP attempts for DPPs that are IN the student's class groups
    solved_dpps_res = await db.execute(
        select(func.count(func.distinct(Attempt.dpp_id)))
        .join(DPP, DPP.id == Attempt.dpp_id)
        .where(Attempt.user_id == target_user_id, DPP.class_group_id.in_(cg_ids))
    )
    solved_dpps = solved_dpps_res.scalar() or 0

    total_items = total_notes + total_dpps
    completed_items = completed_notes + solved_dpps

    return {
        "notes_completed": completed_notes,
        "total_notes": total_notes,
        "dpps_solved": solved_dpps,
        "total_dpps": total_dpps,
        "overall_percentage": round((completed_items / total_items * 100)) if total_items > 0 else 0
    }

@router.get("/progress/class/{class_group_id}")
async def get_class_progress(class_group_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    if current_user.role not in [RoleEnum.admin, RoleEnum.teacher]:
        raise HTTPException(status_code=403, detail="Not authorized")

    # Get total notes and dpps for this class group
    total_notes_res = await db.execute(select(func.count(Note.id)).where(Note.class_group_id == class_group_id))
    total_notes = total_notes_res.scalar() or 0
    
    total_dpps_res = await db.execute(select(func.count(DPP.id)).where(DPP.class_group_id == class_group_id))
    total_dpps = total_dpps_res.scalar() or 0
    
    total_items = total_notes + total_dpps

    # Get all students in this class group
    from backend.models.models import user_class_groups
    students_res = await db.execute(
        select(User).join(user_class_groups).where(
            and_(user_class_groups.c.class_group_id == class_group_id, User.role == RoleEnum.student)
        )
    )
    students = students_res.scalars().all()

    results = []
    for student in students:
        # Get completed notes for this student in this class
        # We join Note to ensure we only count notes in this class group
        completed_notes_res = await db.execute(
            select(func.count(NoteCompletion.id))
            .join(Note, Note.id == NoteCompletion.note_id)
            .where(and_(NoteCompletion.user_id == student.id, Note.class_group_id == class_group_id, NoteCompletion.is_completed == True))
        )
        completed_notes = completed_notes_res.scalar() or 0

        # Get solved dpps for this student in this class
        solved_dpps_res = await db.execute(
            select(func.count(func.distinct(Attempt.dpp_id)))
            .join(DPP, DPP.id == Attempt.dpp_id)
            .where(and_(Attempt.user_id == student.id, DPP.class_group_id == class_group_id))
        )
        solved_dpps = solved_dpps_res.scalar() or 0

        completed_items = completed_notes + solved_dpps
        percentage = round((completed_items / total_items * 100)) if total_items > 0 else 0

        results.append({
            "student_id": student.id,
            "student_name": student.name,
            "student_email": student.email,
            "progress_percentage": percentage,
            "notes_completed": completed_notes,
            "dpps_solved": solved_dpps
        })

    # Sort by progress percentage descending
    results.sort(key=lambda x: x["progress_percentage"], reverse=True)
    return results


async def sync_user_streaks_and_boosters(user_id: int, db: AsyncSession):
    """Lightweight sync: only checks for overnight streak breaks and expired boosters without scanning history."""
    user_res = await db.execute(select(User).where(User.id == user_id))
    user = user_res.scalars().first()
    if not user:
        return None

    has_changes = False
    now = datetime.utcnow()

    # 1. Check Booster expiry
    if user.xp_booster_expiry and now > user.xp_booster_expiry:
        user.xp_booster_multiplier = 1.0
        user.xp_booster_expiry = None
        has_changes = True

    # 2. Check Streak Break & Freezes
    today = now.date()
    if user.last_streak_date:
        gap_to_today = (today - user.last_streak_date.date()).days
        if gap_to_today > 1:
            gap = gap_to_today - 1
            freezers_needed = (gap + 1) // 2
            
            if user.streak_freezers_owned >= freezers_needed:
                user.streak_freezers_owned -= freezers_needed
                
                freezes_to_insert = []
                for i in range(1, gap_to_today):
                    fd = user.last_streak_date.date() + timedelta(days=i)
                    freezes_to_insert.append(StreakFreeze(user_id=user_id, freeze_date=fd))
                db.add_all(freezes_to_insert)
                
                user.streak_count += gap
                user.last_streak_date = datetime(today.year, today.month, today.day, 0, 0, 0) - timedelta(days=1)
                has_changes = True
            else:
                user.streak_count = 0
                user.last_streak_date = None
                has_changes = True

    if has_changes:
        db.add(user)
        await db.commit()
        await db.refresh(user)

    return user


async def recalculate_user_xp_and_streak(user_id: int, db: AsyncSession):
    """Recalculate the user's total XP and streak from the database completions and attempts."""
    # 1. Fetch user
    user_res = await db.execute(select(User).where(User.id == user_id))
    user = user_res.scalars().first()
    if not user:
        return None

    # 2. Fetch all completed notes
    note_res = await db.execute(
        select(NoteCompletion.note_id, NoteCompletion.completed_at).where(
            and_(
                NoteCompletion.user_id == user_id,
                NoteCompletion.is_completed == True,
                NoteCompletion.completed_at != None
            )
        )
    )
    notes = note_res.all()

    # 3. Fetch all completed DPP attempts
    dpp_res = await db.execute(
        select(
            Attempt.dpp_id, Attempt.submitted_at, Attempt.questions_attempted, Attempt.correct_questions
        ).where(
            and_(
                Attempt.user_id == user_id,
                Attempt.completed == True,
                Attempt.submitted_at != None
            )
        )
    )
    dpps = dpp_res.all()

    # 4. Fetch boosters
    booster_res = await db.execute(select(UserBooster).where(UserBooster.user_id == user_id))
    boosters = booster_res.scalars().all()

    # Fetch chest claims
    chest_res = await db.execute(select(UserChestClaim).where(UserChestClaim.user_id == user_id))
    chests = chest_res.scalars().all()
    total_chest_coins = sum(c.coins_rewarded for c in chests)

    # Fetch StreakFreezes
    freeze_res = await db.execute(select(StreakFreeze).where(StreakFreeze.user_id == user_id))
    freezes = freeze_res.scalars().all()

    def get_booster_multiplier(timestamp: datetime) -> float:
        if not timestamp:
            return 1.0
        for b in boosters:
            if b.start_time <= timestamp <= b.end_time:
                return b.multiplier
        return 1.0

    # Group activities by date
    days_data = {}
    for note_id, completed_at in notes:
        dt = completed_at.date()
        mult = get_booster_multiplier(completed_at)
        days_data.setdefault(dt, []).append({"type": "note", "xp": 20 * mult})

    # Deduplicate DPP attempts by dpp_id — keep the one with the latest submitted_at.
    # This prevents double XP if a user somehow has duplicate rows for the same DPP.
    dpp_by_id = {}
    for dpp_id, submitted_at, q_att, correct in dpps:
        existing = dpp_by_id.get(dpp_id)
        if existing is None or submitted_at > existing[1]:
            dpp_by_id[dpp_id] = (dpp_id, submitted_at, q_att, correct)

    for dpp_id, submitted_at, q_att, correct in dpp_by_id.values():
        dt = submitted_at.date()
        qa = q_att or 0
        corr = correct or 0
        base_xp = max(10, corr * 10) if qa > 0 else 50
        mult = get_booster_multiplier(submitted_at)
        days_data.setdefault(dt, []).append({"type": "dpp", "xp": base_xp * mult})

    # Add freezes as activity days with 0 XP
    for f in freezes:
        days_data.setdefault(f.freeze_date, []).append({"type": "freeze", "xp": 0})

    # Sort dates chronologically
    sorted_dates = sorted(days_data.keys())

    calculated_xp = 0
    calculated_note_xp = 0
    calculated_dpp_xp = 0
    streak_count = 0
    prev_date = None
    freezers_available = user.streak_freezers_owned
    freezes_to_insert = []

    for d in sorted_dates:
        if prev_date is None:
            streak_count = 1
        else:
            diff = (d - prev_date).days
            if diff == 1:
                streak_count += 1
            elif diff > 1:
                gap = diff - 1
                freezers_needed = (gap + 1) // 2
                if freezers_available >= freezers_needed:
                    freezers_available -= freezers_needed
                    streak_count += diff
                    for i in range(1, diff):
                        fd = prev_date + timedelta(days=i)
                        freezes_to_insert.append(StreakFreeze(user_id=user_id, freeze_date=fd))
                else:
                    streak_count = 1

        is_bonus_day = streak_count > 0 and streak_count % 6 == 0
        multiplier = 2 if is_bonus_day else 1

        day_base_xp = 0
        for item in days_data[d]:
            base_xp = item["xp"]
            day_base_xp += base_xp
            if item["type"] == "note":
                calculated_note_xp += base_xp * multiplier
            elif item["type"] == "dpp":
                calculated_dpp_xp += base_xp * multiplier

        calculated_xp += day_base_xp * multiplier
        prev_date = d

    # Keep streak count in sync
    today = datetime.utcnow().date()
    if sorted_dates:
        last_activity_date = sorted_dates[-1]
        gap_to_today = (today - last_activity_date).days
        if gap_to_today > 1:
            gap = gap_to_today - 1
            freezers_needed = (gap + 1) // 2
            if freezers_available >= freezers_needed:
                freezers_available -= freezers_needed
                for i in range(1, gap_to_today):
                    fd = last_activity_date + timedelta(days=i)
                    freezes_to_insert.append(StreakFreeze(user_id=user_id, freeze_date=fd))
                final_streak = streak_count + gap
                final_streak_date = datetime(today.year, today.month, today.day, 0, 0, 0) - timedelta(days=1)
            else:
                final_streak = 0
                final_streak_date = datetime(last_activity_date.year, last_activity_date.month, last_activity_date.day, 0, 0, 0)
        else:
            final_streak = streak_count
            final_streak_date = datetime(last_activity_date.year, last_activity_date.month, last_activity_date.day, 0, 0, 0)
    else:
        final_streak = 0
        final_streak_date = None

    if freezes_to_insert:
        db.add_all(freezes_to_insert)

    calculated_level = (calculated_xp // 500) + 1
    total_spent = sum(b.coin_cost for b in boosters)
    
    # Add costs of unactivated boosters in inventory
    if user.inventory_boosters:
        for inv_booster in user.inventory_boosters:
            if isinstance(inv_booster, dict) and "cost" in inv_booster:
                total_spent += inv_booster.get("cost", 0)
                
    # Coins per DPP mirrors the XP formula:
    # MCQ (questions_attempted > 0): max(5, correct_questions * 5) coins
    # Toggle-based (questions_attempted == 0): 50 coins flat
    dpp_coins = sum(
        (max(5, (corr or 0) * 5) if (qa or 0) > 0 else 50)
        for _, _, qa, corr in dpp_by_id.values()
    )
    calculated_coins = max(0, (len(notes) * 20 + dpp_coins + total_chest_coins) - total_spent - (user.streak_freezers_purchased * 600))

    now = datetime.utcnow()
    active_boosters = [b for b in boosters if b.start_time <= now <= b.end_time]
    if active_boosters:
        current_active = max(active_boosters, key=lambda x: x.end_time)
        calculated_booster_expiry = current_active.end_time
        calculated_booster_multiplier = current_active.multiplier
    else:
        calculated_booster_expiry = None
        calculated_booster_multiplier = 1.0

    # Check if there are changes
    has_changes = False
    if user.xp != calculated_xp:
        user.xp = calculated_xp
        has_changes = True
    if user.level != calculated_level:
        user.level = calculated_level
        has_changes = True
    if user.streak_count != final_streak:
        user.streak_count = final_streak
        has_changes = True
    if user.coins != calculated_coins:
        user.coins = calculated_coins
        has_changes = True
    if user.streak_freezers_owned != freezers_available:
        user.streak_freezers_owned = freezers_available
        has_changes = True
    if user.xp_booster_expiry != calculated_booster_expiry:
        user.xp_booster_expiry = calculated_booster_expiry
        has_changes = True
    if user.xp_booster_multiplier != calculated_booster_multiplier:
        user.xp_booster_multiplier = calculated_booster_multiplier
        has_changes = True
    if final_streak_date:
        if not user.last_streak_date or user.last_streak_date.date() != final_streak_date.date():
            user.last_streak_date = final_streak_date
            has_changes = True
    elif user.last_streak_date is not None:
        user.last_streak_date = None
        has_changes = True

    if has_changes:
        db.add(user)
        await db.commit()
        await db.refresh(user)

    return user, int(calculated_note_xp), int(calculated_dpp_xp)


@router.post("/buy-booster")
async def buy_booster(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Purchase an XP booster using coins."""
    if current_user.role != RoleEnum.student:
        raise HTTPException(status_code=403, detail="Only students can purchase boosters")

    booster_type = payload.get("booster_type")
    if booster_type not in ["10m", "30m", "1h", "3h"]:
        raise HTTPException(status_code=400, detail="Invalid booster type")

    # Define durations and costs
    config = {
        "10m": {"minutes": 10, "cost": 100},
        "30m": {"minutes": 30, "cost": 250},
        "1h": {"minutes": 60, "cost": 400},
        "3h": {"minutes": 180, "cost": 600}
    }

    selected = config[booster_type]
    cost = selected["cost"]
    minutes = selected["minutes"]

    # Reload user and recalculate to ensure coins count is perfectly accurate
    await recalculate_user_xp_and_streak(current_user.id, db)
    await db.refresh(current_user)

    if current_user.coins < cost:
        raise HTTPException(status_code=400, detail="Insufficient coins")

    # Append to inventory instead of activating immediately
    current_inventory = list(current_user.inventory_boosters) if current_user.inventory_boosters else []
    current_inventory.append({
        "type": booster_type,
        "cost": cost,
        "minutes": minutes
    })
    current_user.inventory_boosters = current_inventory
    
    # Flag to tell SQLAlchemy the JSON has been modified
    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(current_user, "inventory_boosters")
    
    db.add(current_user)
    await db.commit()

    # Recalculate user XP, levels, and sync quick-access columns
    await recalculate_user_xp_and_streak(current_user.id, db)
    
    # Reload user with relationships to prevent Pydantic serialization errors
    stmt = select(User).options(
        selectinload(User.batch),
        selectinload(User.all_batches),
        selectinload(User.class_groups)
    ).where(User.id == current_user.id)
    res = await db.execute(stmt)
    updated_user = res.scalars().first()

    return updated_user


@router.post("/activate-booster")
async def activate_booster(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Activate a booster from the user's inventory."""
    if current_user.role != RoleEnum.student:
        raise HTTPException(status_code=403, detail="Only students can activate boosters")

    booster_type = payload.get("booster_type")
    
    current_inventory = list(current_user.inventory_boosters) if current_user.inventory_boosters else []
    
    # Find the first matching booster
    match_idx = -1
    for i, inv_booster in enumerate(current_inventory):
        if isinstance(inv_booster, dict) and inv_booster.get("type") == booster_type:
            match_idx = i
            break
            
    if match_idx == -1:
        raise HTTPException(status_code=400, detail="Booster not found in inventory")
        
    # Extract details and remove from inventory
    activated_booster = current_inventory.pop(match_idx)
    minutes = activated_booster.get("minutes", 60)
    # Note: we set coin_cost=0 for the UserBooster record because the cost is already accounted for
    # when it was in inventory_boosters. Wait! 
    # If we remove it from inventory_boosters, it will NO LONGER be counted in `total_spent` for the unactivated boosters.
    # Therefore, we MUST pass its original `cost` to the new `UserBooster` so `total_spent` remains correct!
    cost = activated_booster.get("cost", 0)
    
    current_user.inventory_boosters = current_inventory
    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(current_user, "inventory_boosters")
    
    # Determine start_time: if user has an active booster, stack it
    now = datetime.utcnow()
    start_time = now
    if current_user.xp_booster_expiry and current_user.xp_booster_expiry > now:
        start_time = current_user.xp_booster_expiry

    end_time = start_time + timedelta(minutes=minutes)

    # Save new booster
    new_booster = UserBooster(
        user_id=current_user.id,
        start_time=start_time,
        end_time=end_time,
        multiplier=2.0,
        coin_cost=cost
    )
    db.add(new_booster)
    db.add(current_user)
    await db.commit()

    # Recalculate user XP, levels, and sync quick-access columns
    await recalculate_user_xp_and_streak(current_user.id, db)
    
    # Reload user
    stmt = select(User).options(
        selectinload(User.batch),
        selectinload(User.all_batches),
        selectinload(User.class_groups)
    ).where(User.id == current_user.id)
    res = await db.execute(stmt)
    updated_user = res.scalars().first()

    return updated_user


@router.get("/chests-status", response_model=ChestsStatusResponse)
async def get_chests_status(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    if current_user.role != RoleEnum.student:
        raise HTTPException(status_code=403, detail="Only students have chest achievements")

    # Recalculate first to ensure everything is perfectly up to date
    await recalculate_user_xp_and_streak(current_user.id, db)

    # Start of current UTC calendar week (Monday 00:00:00 UTC)
    now = datetime.utcnow()
    # weekday() returns 0 for Monday, 6 for Sunday
    start_of_week = now - timedelta(days=now.weekday())
    start_of_week = start_of_week.replace(hour=0, minute=0, second=0, microsecond=0)

    # Start of current UTC calendar day (00:00:00 UTC today)
    start_of_today = now.replace(hour=0, minute=0, second=0, microsecond=0)

    # 1. Count notes completed this week
    note_week_res = await db.execute(
        select(func.count(NoteCompletion.id)).where(
            and_(
                NoteCompletion.user_id == current_user.id,
                NoteCompletion.is_completed == True,
                NoteCompletion.completed_at >= start_of_week
            )
        )
    )
    weekly_notes = note_week_res.scalar() or 0

    # 2. Count DPP attempts completed this week
    dpp_week_res = await db.execute(
        select(func.count(func.distinct(Attempt.dpp_id))).where(
            and_(
                Attempt.user_id == current_user.id,
                Attempt.completed == True,
                Attempt.submitted_at >= start_of_week
            )
        )
    )
    weekly_dpps = dpp_week_res.scalar() or 0

    weekly_activities = weekly_notes + weekly_dpps

    # 3. Fetch weekly chest claims
    claims_res = await db.execute(
        select(UserChestClaim).where(
            and_(
                UserChestClaim.user_id == current_user.id,
                UserChestClaim.claimed_at >= start_of_week
            )
        )
    )
    weekly_claims = claims_res.scalars().all()

    claimed_today_normal = any(
        c.chest_type == "normal" and c.claimed_at >= start_of_today for c in weekly_claims
    )
    claimed_this_week_rare = any(c.chest_type == "rare" for c in weekly_claims)
    claimed_this_week_epic = any(c.chest_type == "epic" for c in weekly_claims)
    claimed_this_week_legendary = any(c.chest_type == "legendary" for c in weekly_claims)

    chests_status = [
        ChestStatusOut(
            chest_type="normal",
            label="Daily Chest",
            status="claimed" if claimed_today_normal else "ready_to_claim",
            progress=1 if claimed_today_normal else 1,
            target=1
        ),
        ChestStatusOut(
            chest_type="rare",
            label="Rare Chest",
            status="claimed" if claimed_this_week_rare else "ready_to_claim" if weekly_activities >= 2 else "locked",
            progress=min(2, weekly_activities),
            target=2
        ),
        ChestStatusOut(
            chest_type="epic",
            label="Epic Chest",
            status="claimed" if claimed_this_week_epic else "ready_to_claim" if weekly_activities >= 5 else "locked",
            progress=min(5, weekly_activities),
            target=5
        ),
        ChestStatusOut(
            chest_type="legendary",
            label="Legendary Chest",
            status="claimed" if claimed_this_week_legendary else "ready_to_claim" if weekly_activities >= 10 else "locked",
            progress=min(10, weekly_activities),
            target=10
        )
    ]

    return ChestsStatusResponse(
        chests=chests_status,
        weekly_activity_count=weekly_activities
    )


@router.post("/claim-chest", response_model=ClaimChestResponse)
async def claim_chest(
    payload: ClaimChestRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    if current_user.role != RoleEnum.student:
        raise HTTPException(status_code=403, detail="Only students can claim chests")

    chest_type = payload.chest_type
    if chest_type not in ["normal", "rare", "epic", "legendary"]:
        raise HTTPException(status_code=400, detail="Invalid chest type")

    # Recalculate first to ensure everything is perfectly up to date
    await recalculate_user_xp_and_streak(current_user.id, db)
    await db.refresh(current_user)

    # Start of current UTC calendar week and today
    now = datetime.utcnow()
    start_of_week = now - timedelta(days=now.weekday())
    start_of_week = start_of_week.replace(hour=0, minute=0, second=0, microsecond=0)
    start_of_today = now.replace(hour=0, minute=0, second=0, microsecond=0)

    # 1. Count notes completed this week
    note_week_res = await db.execute(
        select(func.count(NoteCompletion.id)).where(
            and_(
                NoteCompletion.user_id == current_user.id,
                NoteCompletion.is_completed == True,
                NoteCompletion.completed_at >= start_of_week
            )
        )
    )
    weekly_notes = note_week_res.scalar() or 0

    # 2. Count DPP attempts completed this week
    dpp_week_res = await db.execute(
        select(func.count(func.distinct(Attempt.dpp_id))).where(
            and_(
                Attempt.user_id == current_user.id,
                Attempt.completed == True,
                Attempt.submitted_at >= start_of_week
            )
        )
    )
    weekly_dpps = dpp_week_res.scalar() or 0

    weekly_activities = weekly_notes + weekly_dpps

    # 3. Check if already claimed
    if chest_type == "normal":
        existing_res = await db.execute(
            select(UserChestClaim).where(
                and_(
                    UserChestClaim.user_id == current_user.id,
                    UserChestClaim.chest_type == "normal",
                    UserChestClaim.claimed_at >= start_of_today
                )
            )
        )
        if existing_res.scalars().first():
            raise HTTPException(status_code=400, detail="Daily chest already claimed today")
    else:
        existing_res = await db.execute(
            select(UserChestClaim).where(
                and_(
                    UserChestClaim.user_id == current_user.id,
                    UserChestClaim.chest_type == chest_type,
                    UserChestClaim.claimed_at >= start_of_week
                )
            )
        )
        if existing_res.scalars().first():
            raise HTTPException(status_code=400, detail=f"{chest_type.capitalize()} chest already claimed this week")

        # Check target requirements
        targets = {"rare": 2, "epic": 5, "legendary": 10}
        if weekly_activities < targets[chest_type]:
            raise HTTPException(status_code=400, detail="Activity target not reached yet")

    # 4. Roll Rewards
    import random
    coins_rewarded = 0
    booster_rewarded_type = None
    booster_expiry = None

    if chest_type == "normal":
        coins_rewarded = random.randint(20, 50)
    elif chest_type == "rare":
        coins_rewarded = random.randint(80, 150)
    elif chest_type == "epic":
        coins_rewarded = random.randint(200, 400)
        # 25% chance of booster (10m or 30m)
        if random.random() < 0.25:
            booster_rewarded_type = random.choice(["10m", "30m"])
    elif chest_type == "legendary":
        coins_rewarded = random.randint(500, 1000)
        rand_val = random.random()
        if rand_val < 0.40:
            booster_rewarded_type = random.choice(["30m", "1h", "3h"])
        elif rand_val < 0.55:
            current_user.streak_freezers_owned += 1
            booster_rewarded_type = "streak_freezer"

    # 5. If booster is rewarded, save it and activate
    if booster_rewarded_type and booster_rewarded_type != "streak_freezer":
        config = {
            "10m": 10,
            "30m": 30,
            "1h": 60,
            "3h": 180
        }
        minutes = config[booster_rewarded_type]
        
        # Calculate start time (stack if active)
        start_time = now
        if current_user.xp_booster_expiry and current_user.xp_booster_expiry > now:
            start_time = current_user.xp_booster_expiry

        end_time = start_time + timedelta(minutes=minutes)
        booster_expiry = end_time

        new_booster = UserBooster(
            user_id=current_user.id,
            start_time=start_time,
            end_time=end_time,
            multiplier=2.0,
            coin_cost=0  # Awarded for free from chest
        )
        db.add(new_booster)

    # 6. Save chest claim
    new_claim = UserChestClaim(
        user_id=current_user.id,
        chest_type=chest_type,
        coins_rewarded=coins_rewarded,
        booster_rewarded_type=booster_rewarded_type,
        claimed_at=now
    )
    db.add(new_claim)
    await db.commit()

    # Recalculate to update user profile coins & boosters
    await recalculate_user_xp_and_streak(current_user.id, db)

    # Fetch updated user with relations to prevent Pydantic serialization errors
    stmt = select(User).options(
        selectinload(User.batch),
        selectinload(User.all_batches),
        selectinload(User.class_groups)
    ).where(User.id == current_user.id)
    res = await db.execute(stmt)
    updated_user = res.scalars().first()

    return ClaimChestResponse(
        success=True,
        chest_type=chest_type,
        coins_rewarded=coins_rewarded,
        booster_rewarded_type=booster_rewarded_type,
        booster_expiry=booster_expiry,
        user=updated_user
    )


@router.post("/buy-streak-freezer")
async def buy_streak_freezer(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Purchase a streak freezer using coins."""
    if current_user.role != RoleEnum.student:
        raise HTTPException(status_code=403, detail="Only students can purchase streak freezers")

    cost = 600
    await recalculate_user_xp_and_streak(current_user.id, db)
    await db.refresh(current_user)

    if current_user.coins < cost:
        raise HTTPException(status_code=400, detail="Insufficient coins")

    current_user.streak_freezers_purchased += 1
    current_user.streak_freezers_owned += 1
    db.add(current_user)
    await db.commit()
    
    # Recalculate to ensure coins count syncs with purchased properly
    await recalculate_user_xp_and_streak(current_user.id, db)
    await db.refresh(current_user)
    
    return current_user
