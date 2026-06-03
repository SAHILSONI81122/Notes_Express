"""
Shared upload validation utilities.
Used by notes.py, dpp.py, and doubts.py to enforce consistent
file size and MIME type limits across all upload endpoints.
"""
import os
from fastapi import HTTPException, UploadFile

# ── Limits ────────────────────────────────────────────────────────────────────
MAX_PDF_SIZE_MB   = int(os.environ.get("MAX_PDF_SIZE_MB",   "50"))   # PDFs / notes
MAX_IMAGE_SIZE_MB = int(os.environ.get("MAX_IMAGE_SIZE_MB", "10"))   # Images
MAX_AUDIO_SIZE_MB = int(os.environ.get("MAX_AUDIO_SIZE_MB",  "5"))   # Voice messages

# ── Allowed Extensions ────────────────────────────────────────────────────────
ALLOWED_PDF_EXTS   = {".pdf"}
ALLOWED_IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
ALLOWED_AUDIO_EXTS = {".m4a", ".mp3", ".wav", ".mp4", ".aac", ".ogg"}
ALLOWED_NOTE_EXTS  = ALLOWED_PDF_EXTS | ALLOWED_IMAGE_EXTS  # notes can be PDF or images

# ── MIME type allowlist (basic check via Content-Type header) ─────────────────
ALLOWED_NOTE_MIMES  = {
    "application/pdf",
    "image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp",
}
ALLOWED_IMAGE_MIMES = {
    "image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp",
}
ALLOWED_AUDIO_MIMES = {
    "audio/mpeg", "audio/mp3", "audio/mp4", "audio/m4a",
    "audio/wav", "audio/x-wav", "audio/aac", "audio/ogg",
    "video/mp4",  # .mp4 audio recorded on iOS
}


def _mb(n: int) -> int:
    return n * 1024 * 1024


async def validate_upload(
    file: UploadFile,
    allowed_exts: set,
    allowed_mimes: set,
    max_mb: int,
    label: str = "File",
) -> bytes:
    """
    Reads the full file content into memory, validates extension,
    MIME type, and size. Returns the raw bytes so the caller can
    write them without seeking back to 0.

    Raises HTTPException(400) on any violation.
    """
    # ── Extension check ───────────────────────────────────────────────────────
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in allowed_exts:
        raise HTTPException(
            status_code=400,
            detail=f"{label} type not allowed. Accepted extensions: {', '.join(sorted(allowed_exts))}",
        )

    # ── MIME type check (content_type header) ─────────────────────────────────
    mime = (file.content_type or "").lower().split(";")[0].strip()
    if mime and mime not in allowed_mimes:
        raise HTTPException(
            status_code=400,
            detail=f"{label} MIME type '{mime}' is not allowed.",
        )

    # ── Size check (read fully) ───────────────────────────────────────────────
    max_bytes = _mb(max_mb)
    content = await file.read()
    if len(content) > max_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"{label} is too large. Maximum allowed size is {max_mb} MB.",
        )
    if len(content) == 0:
        raise HTTPException(status_code=400, detail=f"{label} is empty.")

    return content
