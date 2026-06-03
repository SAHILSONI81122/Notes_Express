from fastapi import APIRouter, Depends, HTTPException, File, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import or_
from sqlalchemy.orm import selectinload
from typing import List
import os
import io
import uuid
import json
from fpdf import FPDF
from dotenv import load_dotenv
from PIL import Image
from backend.database.database import get_db
from backend.models.models import DPP, User, RoleEnum, Attempt
from backend.schemas.schemas import DPPCreate, DPPOut, DPPQuestionCreate
from backend.services.security import get_current_active_user
from backend.services.upload_validation import (
    validate_upload,
    ALLOWED_IMAGE_EXTS, ALLOWED_IMAGE_MIMES,
    MAX_IMAGE_SIZE_MB,
)
from pydantic import BaseModel

# Load .env so GEMINI_API_KEY is available
load_dotenv()

import google.generativeai as genai

_gemini_model = None

def get_gemini_model():
    """Lazily initialise and return the Gemini 1.5 Flash vision model."""
    global _gemini_model
    if _gemini_model is None:
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError("GEMINI_API_KEY is not set in environment / .env")
        genai.configure(api_key=api_key)
        _gemini_model = genai.GenerativeModel("gemini-2.5-flash")
    return _gemini_model

class RenameRequest(BaseModel):
    name: str

class DPPPDF(FPDF):
    def header(self):
        self.set_font('helvetica', 'B', 15)
        # Premium red/crimson theme matching the Arena styling
        self.set_text_color(185, 28, 28)
        self.cell(0, 10, 'DAILY PRACTICE PROBLEMS (DPP)', border=False, ln=True, align='C')
        self.ln(5)
        
    def footer(self):
        self.set_y(-15)
        self.set_font('helvetica', 'I', 8)
        self.set_text_color(128, 128, 128)
        self.cell(0, 10, f'Page {self.page_no()}/{{nb}}', align='C')

def gemini_extract_text(image_paths: List[str]) -> str:
    """
    Send all images to Gemini Vision and get back plain text of all content.
    Used by /upload-images-ocr to generate a readable PDF.
    """
    model = get_gemini_model()
    parts = []
    for path in image_paths:
        parts.append(Image.open(path))
    parts.append(
        "You are reading a question paper or study material image. "
        "Extract ALL the text content exactly as written, preserving question numbers, "
        "option labels (A/B/C/D), and paragraph structure. "
        "Do NOT add any commentary, headings, or explanations. Just return the raw text."
    )
    response = model.generate_content(parts)
    return response.text.strip()


def gemini_parse_questions(image_paths: List[str]) -> List[dict]:
    """
    Send all images to Gemini Vision and get back a structured JSON list of questions.
    Each question has: question_text, question_type, options (list), correct_option.
    """
    model = get_gemini_model()
    parts = []
    for path in image_paths:
        parts.append(Image.open(path))
    parts.append(
        "You are analyzing a question paper image from a coaching institute. "
        "Extract every question you can see and return ONLY a valid JSON array. "
        "Each element must have these fields:\n"
        "  - question_text: the full question text (string)\n"
        "  - question_type: either 'mcq' or 'subjective' (string)\n"
        "  - options: for MCQ, an array of strings like ['A: option text', 'B: option text', ...]; for subjective, null\n"
        "  - correct_option: the correct option letter (A/B/C/D) if explicitly marked, otherwise null\n"
        "Important rules:\n"
        "- Do NOT infer or guess the correct answer. Only set correct_option if it is clearly indicated in the image.\n"
        "- If the image has no questions, return an empty array [].\n"
        "- Return ONLY the raw JSON array, with no markdown fences, no explanation text."
    )
    response = model.generate_content(parts)
    raw = response.text.strip()
    # Strip markdown code fences if Gemini wraps the JSON
    if raw.startswith('```'):
        raw = raw.split('```')[1]
        if raw.startswith('json'):
            raw = raw[4:]
        raw = raw.strip()
    try:
        questions = json.loads(raw)
        if not isinstance(questions, list):
            questions = []
    except json.JSONDecodeError:
        questions = []
    # Normalise each question to match expected schema
    normalised = []
    for q in questions:
        opts = q.get('options')
        if isinstance(opts, list):
            opts_str = json.dumps(opts)
        elif isinstance(opts, str):
            opts_str = opts
        else:
            opts_str = None
        normalised.append({
            'question_text': str(q.get('question_text', '')).strip(),
            'question_type': str(q.get('question_type', 'subjective')).lower(),
            'options': opts_str,
            'correct_option': q.get('correct_option') or None,
        })
    return normalised

def clean_text_for_fpdf(text: str) -> str:
    # Replace common unicode/curly punctuation that crashes FPDF
    replacements = {
        '\u2018': "'",  # Left single quotation mark
        '\u2019': "'",  # Right single quotation mark
        '\u201c': '"',  # Left double quotation mark
        '\u201d': '"',  # Right double quotation mark
        '\u2013': '-',  # En dash
        '\u2014': '-',  # Em dash
        '\u2022': '*',  # Bullet
        '\u2026': '...', # Horizontal ellipsis
        '\u00a0': ' ',   # Non-breaking space
        '\u2212': '-',   # Minus sign
    }
    for orig, rep in replacements.items():
        text = text.replace(orig, rep)
    
    # Encode as latin-1, ignoring characters we can't represent
    return text.encode('latin-1', 'ignore').decode('latin-1')

def generate_dpp_pdf(extracted_texts: List[str], output_path: str, title: str):
    pdf = DPPPDF()
    pdf.alias_nb_pages()
    pdf.add_page()
    
    # Draw a nice header banner
    pdf.set_fill_color(243, 244, 246) # Light gray background
    pdf.rect(10, 25, 190, 25, 'F')
    
    pdf.set_y(28)
    pdf.set_font('helvetica', 'B', 14)
    pdf.set_text_color(17, 24, 39) # Dark text
    pdf.cell(0, 8, clean_text_for_fpdf(title.upper()), ln=True, align='C')
    
    pdf.set_font('helvetica', '', 10)
    pdf.set_text_color(107, 114, 128) # Gray text
    pdf.cell(0, 6, "Generated via offline AI text-recognition from uploaded image(s)", ln=True, align='C')
    
    pdf.ln(15)
    
    # Content
    pdf.set_font('helvetica', '', 11)
    pdf.set_text_color(31, 41, 55) # Dark gray body
    
    for idx, text in enumerate(extracted_texts, 1):
        if len(extracted_texts) > 1:
            pdf.set_font('helvetica', 'B', 12)
            pdf.set_text_color(185, 28, 28)
            pdf.cell(0, 10, f"Section {idx}", ln=True)
            pdf.set_font('helvetica', '', 11)
            pdf.set_text_color(31, 41, 55)
            pdf.ln(2)
        
        # Clean text first
        cleaned_text = clean_text_for_fpdf(text)
        lines = cleaned_text.split('\n')
        for line in lines:
            line = line.strip()
            if not line:
                pdf.ln(4)
                continue
            pdf.multi_cell(pdf.epw, 6, line)
        pdf.ln(8)
        
    pdf.output(output_path)

router = APIRouter(tags=["dpp"])

@router.post("/create-dpp", response_model=DPPOut)
async def create_dpp(dpp: DPPCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    if current_user.role not in [RoleEnum.teacher, RoleEnum.admin]:
        raise HTTPException(status_code=403, detail="Only teachers and admins can create DPPs")
    
    new_dpp = DPP(
        title=dpp.title,
        file_url=dpp.file_url,
        total_questions=dpp.total_questions,
        batch_id=dpp.batch_id,
        class_group_id=dpp.class_group_id,
        folder_id=dpp.folder_id,
        created_by=current_user.id
    )
    db.add(new_dpp)
    await db.commit()
    await db.refresh(new_dpp)
    
    if dpp.questions:
        from backend.models.models import DPPQuestion
        for q in dpp.questions:
            new_q = DPPQuestion(
                dpp_id=new_dpp.id,
                question_text=q.question_text,
                question_type=q.question_type,
                options=q.options,
                correct_option=q.correct_option
            )
            db.add(new_q)
        await db.commit()

    # Load with selectinload
    stmt = select(DPP).where(DPP.id == new_dpp.id).options(selectinload(DPP.questions))
    res = await db.execute(stmt)
    created_dpp = res.scalars().first()
    
    # Trigger push notifications
    try:
        from backend.services.notifications import send_push_notifications
        
        # Base query to get students in the batch with push tokens
        stmt = select(User).where(User.batch_id == dpp.batch_id, User.role == RoleEnum.student, User.expo_push_token.is_not(None))
        
        # If class_group_id is specified, filter by class group
        if dpp.class_group_id:
            stmt = stmt.options(selectinload(User.class_groups))
            
        result = await db.execute(stmt)
        users = result.scalars().all()
        
        tokens = []
        for u in users:
            if dpp.class_group_id:
                if any(cg.id == dpp.class_group_id for cg in u.class_groups):
                    tokens.append(u.expo_push_token)
            else:
                tokens.append(u.expo_push_token)
                
        if tokens:
            send_push_notifications(tokens, f"New DPP Added: {dpp.title}")
    except Exception as e:
        print(f"Error sending push notification: {e}")
        
    return created_dpp

@router.get("/dpps/{batch_id}", response_model=List[DPPOut])
async def get_dpps(batch_id: int, class_group_id: int = None, folder_id: int = None, search: str = None, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    if current_user.role == RoleEnum.student and current_user.batch_id != batch_id:
        raise HTTPException(status_code=403, detail="Access denied")
        
    query = select(DPP).where(DPP.batch_id == batch_id).options(selectinload(DPP.questions))
    if current_user.role == RoleEnum.student:
        user_res = await db.execute(select(User).where(User.id == current_user.id).options(selectinload(User.class_groups)))
        user = user_res.scalars().first()
        user_cg_ids = [cg.id for cg in user.class_groups if cg.batch_id == batch_id]
        if user_cg_ids:
            query = query.where(DPP.class_group_id.in_(user_cg_ids))
        else:
            return []
    else:
        if class_group_id:
            query = query.where(DPP.class_group_id == class_group_id)
        else:
            return []
    
    if search:
        query = query.where(DPP.title.ilike(f"%{search}%"))
    else:
        if folder_id:
            query = query.where(DPP.folder_id == folder_id)
        else:
            query = query.where(DPP.folder_id == None)
            
    result = await db.execute(query)
    dpps = result.scalars().all()
    
    # If student, attach their attempt history
    if current_user.role == RoleEnum.student:
        attempt_res = await db.execute(select(Attempt).where(Attempt.user_id == current_user.id))
        attempts = {a.dpp_id: a for a in attempt_res.scalars().all()}
        
        for dpp in dpps:
            dpp.user_attempt = attempts.get(dpp.id)
            
    return dpps

@router.put("/dpps/{dpp_id}/rename")
async def rename_dpp(dpp_id: int, request: RenameRequest, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    if current_user.role not in [RoleEnum.admin, RoleEnum.teacher]:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    result = await db.execute(select(DPP).where(DPP.id == dpp_id))
    dpp = result.scalars().first()
    if not dpp: raise HTTPException(status_code=404, detail="DPP not found")
    dpp.title = request.name
    await db.commit()
    return dpp

@router.delete("/dpps/{dpp_id}")
async def delete_dpp(dpp_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    if current_user.role not in [RoleEnum.admin, RoleEnum.teacher]:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    result = await db.execute(select(DPP).where(DPP.id == dpp_id))
    dpp = result.scalars().first()
    if not dpp:
        raise HTTPException(status_code=404, detail="DPP not found")
        
    await db.delete(dpp)
    await db.commit()
    return {"message": "DPP deleted successfully"}

@router.put("/dpps/{dpp_id}/questions")
async def update_dpp_questions(dpp_id: int, questions: List[DPPQuestionCreate], db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    if current_user.role not in [RoleEnum.admin, RoleEnum.teacher]:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    result = await db.execute(select(DPP).where(DPP.id == dpp_id))
    dpp = result.scalars().first()
    if not dpp:
        raise HTTPException(status_code=404, detail="DPP not found")
        
    from backend.models.models import DPPQuestion
    
    # Delete existing questions
    await db.execute(DPPQuestion.__table__.delete().where(DPPQuestion.dpp_id == dpp_id))
    
    # Insert new questions
    for q in questions:
        new_q = DPPQuestion(
            dpp_id=dpp.id,
            question_text=q.question_text,
            question_type=q.question_type,
            options=q.options,
            correct_option=q.correct_option
        )
        db.add(new_q)
        
    dpp.total_questions = len(questions)
    dpp.is_parsed = True # Ensures the app treats it as a parsed DPP now
    await db.commit()
    
    return {"message": "DPP questions updated successfully"}

@router.post("/upload-images-ocr")
async def upload_images_ocr(
    title: str,
    files: List[UploadFile] = File(...),
    current_user: User = Depends(get_current_active_user)
):
    if current_user.role not in [RoleEnum.teacher, RoleEnum.admin]:
        raise HTTPException(status_code=403, detail="Only teachers/admins can upload and OCR images")

    if not files:
        raise HTTPException(status_code=400, detail="No images provided")
    if len(files) > 20:
        raise HTTPException(status_code=400, detail="Maximum 20 images per OCR upload.")

    UPLOAD_DIR = "backend/uploads"
    image_paths = []

    try:
        for file in files:
            content = await validate_upload(
                file,
                allowed_exts=ALLOWED_IMAGE_EXTS,
                allowed_mimes=ALLOWED_IMAGE_MIMES,
                max_mb=MAX_IMAGE_SIZE_MB,
                label="Image",
            )
            ext = os.path.splitext(file.filename or "")[1].lower() or ".jpg"
            temp_name = f"ocr_temp_{uuid.uuid4()}{ext}"
            temp_path = os.path.join(UPLOAD_DIR, temp_name)
            image_paths.append(temp_path)
            with open(temp_path, "wb") as f:
                f.write(content)

        combined_text = gemini_extract_text(image_paths)

        for tp in image_paths:
            if os.path.exists(tp):
                os.remove(tp)

        if not combined_text:
            raise HTTPException(status_code=400, detail="Could not extract any text from the provided images")

        pdf_name = f"dpp_ocr_{uuid.uuid4()}.pdf"
        pdf_path = os.path.join(UPLOAD_DIR, pdf_name)
        generate_dpp_pdf([combined_text], pdf_path, title)

        return {"file_url": f"/uploads/{pdf_name}"}

    except HTTPException:
        raise
    except Exception as e:
        for tp in image_paths:
            if os.path.exists(tp):
                os.remove(tp)
        raise HTTPException(status_code=500, detail=f"Gemini Vision extraction failed: {str(e)}")

@router.post("/parse-images-ocr")
async def parse_images_ocr(
    files: List[UploadFile] = File(...),
    current_user: User = Depends(get_current_active_user)
):
    """Use Gemini Vision to extract and structure questions from uploaded images."""
    if current_user.role not in [RoleEnum.teacher, RoleEnum.admin]:
        raise HTTPException(status_code=403, detail="Only teachers/admins can parse images")

    if not files:
        raise HTTPException(status_code=400, detail="No images provided")
    if len(files) > 20:
        raise HTTPException(status_code=400, detail="Maximum 20 images per parse request.")

    UPLOAD_DIR = "backend/uploads"
    image_paths = []

    try:
        for file in files:
            content = await validate_upload(
                file,
                allowed_exts=ALLOWED_IMAGE_EXTS,
                allowed_mimes=ALLOWED_IMAGE_MIMES,
                max_mb=MAX_IMAGE_SIZE_MB,
                label="Image",
            )
            ext = os.path.splitext(file.filename or "")[1].lower() or ".jpg"
            temp_name = f"gemini_parse_{uuid.uuid4()}{ext}"
            temp_path = os.path.join(UPLOAD_DIR, temp_name)
            image_paths.append(temp_path)
            with open(temp_path, "wb") as f:
                f.write(content)

        parsed_questions = gemini_parse_questions(image_paths)

        for tp in image_paths:
            if os.path.exists(tp):
                os.remove(tp)

        if not parsed_questions:
            raise HTTPException(
                status_code=400,
                detail="Gemini could not find any questions in the provided images. "
                       "Please ensure the images are clear and contain readable question text."
            )

        return parsed_questions

    except HTTPException:
        raise
    except Exception as e:
        for tp in image_paths:
            if os.path.exists(tp):
                os.remove(tp)
        raise HTTPException(status_code=500, detail=f"Gemini Vision parsing failed: {str(e)}")
