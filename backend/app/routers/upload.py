import uuid
import os
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from app.core.deps import get_current_user
from app.models.user import User

UPLOAD_DIR = "/app/uploads"
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
ALLOWED_VIDEO_TYPES = {"video/mp4", "video/webm", "video/quicktime"}
MAX_IMAGE_SIZE = 5 * 1024 * 1024    # 5 MB
MAX_MEDIA_SIZE = 50 * 1024 * 1024   # 50 MB

router = APIRouter(prefix="/upload", tags=["upload"])


@router.post("/image")
async def upload_image(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Solo se permiten imágenes JPG, PNG, WEBP o GIF")

    contents = await file.read()
    if len(contents) > MAX_IMAGE_SIZE:
        raise HTTPException(status_code=400, detail="La imagen no puede superar 5 MB")

    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else "jpg"
    filename = f"{uuid.uuid4().hex}.{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)

    with open(filepath, "wb") as f:
        f.write(contents)

    return {"url": f"/uploads/{filename}"}


@router.post("/media")
async def upload_media(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """Acepta imagen o video para stories. Retorna url + media_type."""
    allowed = ALLOWED_IMAGE_TYPES | ALLOWED_VIDEO_TYPES
    if file.content_type not in allowed:
        raise HTTPException(
            status_code=400,
            detail="Formato no permitido. Usá JPG, PNG, WEBP, GIF, MP4, WEBM o MOV",
        )

    contents = await file.read()
    if len(contents) > MAX_MEDIA_SIZE:
        raise HTTPException(status_code=400, detail="El archivo no puede superar 50 MB")

    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else "bin"
    filename = f"{uuid.uuid4().hex}.{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)

    with open(filepath, "wb") as f:
        f.write(contents)

    media_type = "video" if file.content_type in ALLOWED_VIDEO_TYPES else "image"
    return {"url": f"/uploads/{filename}", "media_type": media_type}
