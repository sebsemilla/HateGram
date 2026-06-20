from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel
from app.db.database import get_db
from app.models.user import User
from app.models.post import Post
from app.models.report import Report
from app.models.profile import Profile
from app.core.deps import get_admin_user
from app.core.config import settings
from app.core.security import create_access_token

router = APIRouter(prefix="/admin", tags=["admin"])


# ── Stats ──────────────────────────────────────────────────────────────────

@router.get("/stats")
def get_stats(db: Session = Depends(get_db), _: User = Depends(get_admin_user)):
    return {
        "total_users": db.query(func.count(User.id)).scalar(),
        "active_users": db.query(func.count(User.id)).filter(User.is_active == True).scalar(),
        "total_posts": db.query(func.count(Post.id)).scalar(),
        "pending_reports": db.query(func.count(Report.id)).filter(Report.status == "pending").scalar(),
        "total_reports": db.query(func.count(Report.id)).scalar(),
    }


# ── Reportes ───────────────────────────────────────────────────────────────

@router.get("/reports")
def list_reports(
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    q = db.query(Report)
    if status:
        q = q.filter(Report.status == status)
    reports = q.order_by(Report.created_at.desc()).offset(skip).limit(limit).all()

    result = []
    for r in reports:
        post = r.reported_post
        reported_user = r.reported_user
        entry = {
            "id": r.id,
            "reason": r.reason,
            "description": r.description,
            "status": r.status,
            "created_at": r.created_at.isoformat(),
            "reporter": r.reporter.username if r.reporter else None,
            "reported_user_id": r.reported_user_id,
            "reported_user": reported_user.username if reported_user else None,
            "reported_user_active": reported_user.is_active if reported_user else None,
            "reported_post_id": r.reported_post_id,
            "reported_post_caption": (post.caption or "") if post else None,
            "reported_post_image": (post.image_url or "") if post else None,
            "reported_post_exists": post is not None,
        }
        result.append(entry)
    return result


class ReportAction(BaseModel):
    status: str  # resolved | dismissed


@router.patch("/reports/{report_id}")
def update_report(
    report_id: int,
    data: ReportAction,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    if data.status not in ("resolved", "dismissed"):
        raise HTTPException(status_code=400, detail="Estado inválido")
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Reporte no encontrado")
    report.status = data.status
    report.resolved_at = datetime.now(timezone.utc)
    db.commit()
    return {"message": "Reporte actualizado"}


# ── Usuarios ───────────────────────────────────────────────────────────────

@router.get("/users")
def list_users(
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    users = db.query(User).order_by(User.created_at.desc()).offset(skip).limit(limit).all()
    return [
        {
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "is_active": u.is_active,
            "is_admin": u.is_admin,
            "is_fictitious": u.is_fictitious,
            "created_at": u.created_at.isoformat(),
            "display_name": u.profile.display_name if u.profile else u.username,
            "avatar_url": u.profile.avatar_url if u.profile else "",
        }
        for u in users
    ]


class ApiKeysUpdate(BaseModel):
    youtube_api_key: Optional[str] = None
    gemini_api_key: Optional[str] = None


@router.get("/api-keys")
def get_api_keys(_: User = Depends(get_admin_user)):
    return {
        "youtube_api_key": "●●●●" if settings.YOUTUBE_API_KEY else "",
        "gemini_api_key":  "●●●●" if settings.GEMINI_API_KEY else "",
        "youtube_configured": bool(settings.YOUTUBE_API_KEY),
        "gemini_configured":  bool(settings.GEMINI_API_KEY),
    }


@router.patch("/api-keys")
def update_api_keys(data: ApiKeysUpdate, _: User = Depends(get_admin_user)):
    """Actualiza las API keys en memoria para la sesión actual.
    Para hacerlas permanentes deben setearse en docker-compose.yml."""
    if data.youtube_api_key is not None:
        settings.YOUTUBE_API_KEY = data.youtube_api_key
    if data.gemini_api_key is not None:
        settings.GEMINI_API_KEY = data.gemini_api_key
    return {
        "youtube_configured": bool(settings.YOUTUBE_API_KEY),
        "gemini_configured":  bool(settings.GEMINI_API_KEY),
    }


@router.post("/impersonate/{user_id}")
def impersonate_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    """Genera un token de acceso para cualquier usuario — sólo admins."""
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Ya sos este usuario")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    token = create_access_token({"sub": user.username})
    return {
        "access_token": token,
        "token_type": "bearer",
        "username": user.username,
        "display_name": user.profile.display_name if user.profile else user.username,
        "avatar_url": user.profile.avatar_url if user.profile else "",
        "is_admin": user.is_admin,
        "is_fictitious": user.is_fictitious,
    }


@router.delete("/posts/{post_id}", status_code=204)
def admin_delete_post(
    post_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post no encontrado")
    db.delete(post)
    db.commit()


@router.patch("/users/{user_id}/toggle-active")
def toggle_user_active(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="No podés desactivarte a vos mismo")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    user.is_active = not user.is_active
    db.commit()
    return {"username": user.username, "is_active": user.is_active}
