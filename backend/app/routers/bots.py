import random
import string
from typing import Optional
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.bot import Bot, BotAction
from app.models.user import User
from app.models.profile import Profile
from app.core.deps import get_admin_user
from app.core.security import hash_password

router = APIRouter(prefix="/bots", tags=["bots"])

ACTION_LABELS = {
    "post":          "Publicar post",
    "youtube_post":  "Postear desde YouTube",
    "vote_truth":    "Votar Truth",
    "vote_fake":     "Votar Fake",
    "vote_for":      "Votar A Favor (debate)",
    "vote_against":  "Votar En Contra (debate)",
}


# ── Helpers ─────────────────────────────────────────────────────────────────

def _random_suffix(length: int = 6) -> str:
    return "".join(random.choices(string.ascii_lowercase + string.digits, k=length))


def _dicebear_url(seed: str) -> str:
    """Avatar generado automáticamente basado en el username — sin API key."""
    return f"https://api.dicebear.com/9.x/avataaars/svg?seed={seed}&backgroundColor=b6e3f4,c0aede,d1d4f9"


def _build_bot_out(bot: Bot) -> dict:
    profile = bot.user.profile
    return {
        "id": bot.id,
        "user_id": bot.user_id,
        "username": bot.user.username,
        "display_name": profile.display_name if profile else bot.user.username,
        "avatar_url": profile.avatar_url if profile else _dicebear_url(bot.user.username),
        "bio": profile.bio if profile else "",
        "location": profile.location if profile else "",
        "website": profile.website if profile else "",
        "template": bot.template,
        "is_active": bot.is_active,
        "created_at": bot.created_at.isoformat(),
        "active_until": bot.active_until.isoformat() if bot.active_until else None,
        "actions": [
            {
                "id": a.id,
                "action_type": a.action_type,
                "action_label": ACTION_LABELS.get(a.action_type, a.action_type),
                "frequency_hours": a.frequency_hours,
                "content_pool": a.content_pool or [],
                "community_id": a.community_id,
                "last_run": a.last_run.isoformat() if a.last_run else None,
                "youtube_channel_id": a.youtube_channel_id or "",
                "youtube_last_video_id": a.youtube_last_video_id or "",
                "gemini_prompt": a.gemini_prompt or "",
                "run_log": list(a.run_log or []),
            }
            for a in bot.actions
        ],
    }


def _create_bot_user(
    display_name: str,
    db: Session,
    bio: str = "",
    location: str = "",
    website: str = "",
    avatar_url: str = "",
) -> User:
    username = f"bot_{_random_suffix()}"
    while db.query(User).filter(User.username == username).first():
        username = f"bot_{_random_suffix()}"

    user = User(
        username=username,
        email=f"{username}@bot.internal",
        hashed_password=hash_password(_random_suffix(16)),
        is_fictitious=True,
        is_active=True,
    )
    db.add(user)
    db.flush()  # obtener ID sin commit

    profile = Profile(
        user_id=user.id,
        display_name=display_name,
        bio=bio,
        location=location,
        website=website,
        avatar_url=avatar_url or _dicebear_url(username),
    )
    db.add(profile)
    return user


# ── Endpoints ───────────────────────────────────────────────────────────────

@router.get("/")
def list_bots(db: Session = Depends(get_db), _: User = Depends(get_admin_user)):
    bots = db.query(Bot).order_by(Bot.created_at.desc()).all()
    return [_build_bot_out(b) for b in bots]


class BotCreate(BaseModel):
    display_name: str
    bio: Optional[str] = ""
    location: Optional[str] = ""
    website: Optional[str] = ""
    avatar_url: Optional[str] = ""
    template: str = "custom"
    content_pool: list[str] = []
    community_id: Optional[int] = None


class BotBatchCreate(BaseModel):
    count: int  # 1–50
    name_prefix: str = "Bot"
    bio: Optional[str] = ""
    location: Optional[str] = ""
    website: Optional[str] = ""
    template: str = "custom"
    content_pool: list[str] = []
    community_id: Optional[int] = None


@router.post("/", status_code=201)
def create_bot(data: BotCreate, db: Session = Depends(get_db), _: User = Depends(get_admin_user)):
    user = _create_bot_user(
        display_name=data.display_name,
        db=db,
        bio=data.bio or "",
        location=data.location or "",
        website=data.website or "",
        avatar_url=data.avatar_url or "",
    )
    bot = Bot(user_id=user.id, template=data.template)
    db.add(bot)
    db.flush()

    db.commit()
    db.refresh(bot)
    return _build_bot_out(bot)


@router.post("/batch", status_code=201)
def create_bots_batch(
    data: BotBatchCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    if not (1 <= data.count <= 50):
        raise HTTPException(status_code=400, detail="El count debe estar entre 1 y 50")

    created = []
    for i in range(data.count):
        display_name = f"{data.name_prefix} {_random_suffix(4).upper()}"
        user = _create_bot_user(
            display_name=display_name,
            db=db,
            bio=data.bio or "",
            location=data.location or "",
            website=data.website or "",
        )
        bot = Bot(user_id=user.id, template=data.template)
        db.add(bot)
        db.flush()
        created.append(bot)

    db.commit()
    for b in created:
        db.refresh(b)
    return {"created": len(created), "bots": [_build_bot_out(b) for b in created]}


@router.patch("/{bot_id}/toggle")
def toggle_bot(bot_id: int, db: Session = Depends(get_db), _: User = Depends(get_admin_user)):
    bot = db.query(Bot).filter(Bot.id == bot_id).first()
    if not bot:
        raise HTTPException(status_code=404, detail="Bot no encontrado")
    bot.is_active = not bot.is_active
    db.commit()
    return {"id": bot.id, "is_active": bot.is_active}


class ProfileUpdate(BaseModel):
    display_name: Optional[str] = None
    bio: Optional[str] = None
    location: Optional[str] = None
    website: Optional[str] = None
    avatar_url: Optional[str] = None
    banner_url: Optional[str] = None


@router.patch("/{bot_id}/profile")
def update_bot_profile(
    bot_id: int,
    data: ProfileUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    bot = db.query(Bot).filter(Bot.id == bot_id).first()
    if not bot:
        raise HTTPException(status_code=404, detail="Bot no encontrado")
    profile = bot.user.profile
    if not profile:
        raise HTTPException(status_code=404, detail="Perfil no encontrado")
    for field, value in data.model_dump(exclude_none=True).items():
        if value != "":
            setattr(profile, field, value)
    db.commit()
    db.refresh(bot)
    return _build_bot_out(bot)


@router.delete("/{bot_id}", status_code=204)
def delete_bot(bot_id: int, db: Session = Depends(get_db), _: User = Depends(get_admin_user)):
    bot = db.query(Bot).filter(Bot.id == bot_id).first()
    if not bot:
        raise HTTPException(status_code=404, detail="Bot no encontrado")
    user = bot.user
    db.delete(bot)
    db.delete(user)
    db.commit()


class ActionUpdate(BaseModel):
    action_type: Optional[str] = None
    frequency_hours: Optional[float] = None
    content_pool: Optional[list[str]] = None
    community_id: Optional[int] = None
    youtube_channel_id: Optional[str] = None
    gemini_prompt: Optional[str] = None


@router.patch("/{bot_id}/actions/{action_id}")
def update_action(
    bot_id: int,
    action_id: int,
    data: ActionUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    action = db.query(BotAction).filter(BotAction.id == action_id, BotAction.bot_id == bot_id).first()
    if not action:
        raise HTTPException(status_code=404, detail="Acción no encontrada")
    if data.frequency_hours is not None:
        action.frequency_hours = data.frequency_hours
    if data.content_pool is not None:
        action.content_pool = data.content_pool
    if data.community_id is not None:
        action.community_id = data.community_id
    if data.youtube_channel_id is not None:
        action.youtube_channel_id = data.youtube_channel_id
    if data.gemini_prompt is not None:
        action.gemini_prompt = data.gemini_prompt
    db.commit()
    db.refresh(action.bot)
    return _build_bot_out(action.bot)


@router.post("/{bot_id}/actions", status_code=201)
def add_action(
    bot_id: int,
    data: ActionUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    bot = db.query(Bot).filter(Bot.id == bot_id).first()
    if not bot:
        raise HTTPException(status_code=404, detail="Bot no encontrado")
    action = BotAction(
        bot_id=bot_id,
        action_type=data.action_type or "vote_truth",
        frequency_hours=data.frequency_hours or 4.0,
        content_pool=data.content_pool or [],
        community_id=data.community_id,
        youtube_channel_id=data.youtube_channel_id,
        gemini_prompt=data.gemini_prompt,
    )
    db.add(action)
    db.commit()
    db.refresh(bot)
    return _build_bot_out(bot)


@router.delete("/{bot_id}/actions/{action_id}", status_code=204)
def delete_action(
    bot_id: int,
    action_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    action = db.query(BotAction).filter(BotAction.id == action_id, BotAction.bot_id == bot_id).first()
    if not action:
        raise HTTPException(status_code=404, detail="Acción no encontrada")
    db.delete(action)
    db.commit()


# ── Duración del bot ─────────────────────────────────────────────────────────

class BotUpdate(BaseModel):
    duration_days: Optional[int] = None  # 0 = sin expiración


@router.patch("/{bot_id}")
def update_bot(
    bot_id: int,
    data: BotUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    bot = db.query(Bot).filter(Bot.id == bot_id).first()
    if not bot:
        raise HTTPException(status_code=404, detail="Bot no encontrado")
    if data.duration_days is not None:
        if data.duration_days <= 0:
            bot.active_until = None
        else:
            bot.active_until = datetime.now(timezone.utc) + timedelta(days=data.duration_days)
    db.commit()
    db.refresh(bot)
    return _build_bot_out(bot)


# ── Ejecutar acciones ahora ───────────────────────────────────────────────────

@router.post("/{bot_id}/run")
def run_bot_now(
    bot_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    from app.scheduler import ACTION_HANDLERS
    bot = db.query(Bot).filter(Bot.id == bot_id).first()
    if not bot:
        raise HTTPException(status_code=404, detail="Bot no encontrado")

    now = datetime.now(timezone.utc)
    results = []
    for action in bot.actions:
        handler = ACTION_HANDLERS.get(action.action_type)
        if not handler:
            results.append({"action_id": action.id, "status": "sin_handler"})
            continue
        try:
            handler(action, db)
            action.last_run = now
            log = list(action.run_log or [])
            log.append(now.isoformat())
            action.run_log = log[-20:]
            db.commit()
            results.append({"action_id": action.id, "action_type": action.action_type, "status": "ok"})
        except Exception as e:
            db.rollback()
            results.append({"action_id": action.id, "action_type": action.action_type, "status": "error", "detail": str(e)})

    db.refresh(bot)
    return {"results": results, "bot": _build_bot_out(bot)}
