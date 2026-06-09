"""
Scheduler de bots — corre cada 5 minutos y ejecuta las acciones pendientes.
"""
import random
import logging
import httpx
from datetime import datetime, timezone, timedelta

from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy.orm import Session

from app.db.database import SessionLocal
from app.models.bot import Bot, BotAction
from app.models.post import Post
from app.models.fact_vote import FactVote
from app.models.debate import Debate, DebateVote
from app.core.config import settings

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("bot_scheduler")

scheduler = BackgroundScheduler(timezone="UTC")


# ── YouTube + Gemini ────────────────────────────────────────────────────────

def _resolve_channel_id(handle_or_id: str) -> str | None:
    """Convierte @handle o nombre a Channel ID (UCxxx). Si ya es ID lo devuelve igual."""
    if handle_or_id.startswith("UC"):
        return handle_or_id
    # Es un @handle — buscar el channel ID real
    handle = handle_or_id.lstrip("@")
    try:
        r = httpx.get(
            "https://www.googleapis.com/youtube/v3/channels",
            params={"part": "id", "forHandle": handle, "key": settings.YOUTUBE_API_KEY},
            timeout=10,
        )
        r.raise_for_status()
        items = r.json().get("items", [])
        return items[0]["id"] if items else None
    except Exception as e:
        logger.warning(f"No se pudo resolver el handle @{handle}: {e}")
        return None


def _youtube_latest_video(channel_id: str) -> dict | None:
    """Devuelve {'video_id', 'title', 'description', 'thumbnail'} del video más reciente."""
    if not settings.YOUTUBE_API_KEY:
        return None
    # Resolver @handle si es necesario
    resolved = _resolve_channel_id(channel_id)
    if not resolved:
        logger.warning(f"No se pudo resolver el canal: {channel_id}")
        return None
    channel_id = resolved
    try:
        url = "https://www.googleapis.com/youtube/v3/search"
        params = {
            "part": "snippet",
            "channelId": channel_id,
            "maxResults": 1,
            "order": "date",
            "type": "video",
            "key": settings.YOUTUBE_API_KEY,
        }
        r = httpx.get(url, params=params, timeout=10)
        r.raise_for_status()
        items = r.json().get("items", [])
        if not items:
            return None
        item = items[0]
        return {
            "video_id":    item["id"]["videoId"],
            "title":       item["snippet"]["title"],
            "description": item["snippet"]["description"][:500],
            "thumbnail":   item["snippet"]["thumbnails"].get("high", {}).get("url", ""),
        }
    except Exception as e:
        logger.warning(f"YouTube API error: {e}")
        return None


def _gemini_caption(video: dict, prompt_template: str | None) -> str:
    """Genera una caption usando Gemini Flash. Devuelve texto vacío si falla."""
    if not settings.GEMINI_API_KEY:
        return ""
    base_prompt = prompt_template or (
        "Sos un usuario de una red social. Acabás de ver este video de YouTube. "
        "Escribí un comentario breve (máximo 2 oraciones), opinión personal, en español. "
        "Sin hashtags. Sin emojis. Que suene humano y natural."
    )
    full_prompt = (
        f"{base_prompt}\n\n"
        f"Título del video: {video['title']}\n"
        f"Descripción: {video['description']}"
    )
    try:
        url = (
            "https://generativelanguage.googleapis.com/v1beta/models/"
            f"gemini-1.5-flash:generateContent?key={settings.GEMINI_API_KEY}"
        )
        body = {"contents": [{"parts": [{"text": full_prompt}]}]}
        r = httpx.post(url, json=body, timeout=15)
        r.raise_for_status()
        parts = r.json()["candidates"][0]["content"]["parts"]
        return parts[0]["text"].strip()
    except Exception as e:
        logger.warning(f"Gemini API error: {e}")
        return ""


# ── Ejecutores de acción ────────────────────────────────────────────────────

def _exec_post(action: BotAction, db: Session) -> None:
    pool = action.content_pool or []
    if not pool:
        return
    text = random.choice(pool)
    post = Post(user_id=action.bot.user_id, caption=text, community_id=action.community_id)
    db.add(post)


def _exec_youtube_post(action: BotAction, db: Session) -> None:
    if not action.youtube_channel_id:
        return

    video = _youtube_latest_video(action.youtube_channel_id)
    if not video:
        return

    # Ya procesamos este video antes — no repostear
    if video["video_id"] == action.youtube_last_video_id:
        return

    video_url = f"https://www.youtube.com/watch?v={video['video_id']}"

    # Generar caption con Gemini (puede quedar vacío si no hay API key)
    caption = _gemini_caption(video, action.gemini_prompt)

    post = Post(
        user_id=action.bot.user_id,
        caption=caption,
        link_url=video_url,
        link_title=video["title"],
        link_description=video["description"][:300],
        link_image=video["thumbnail"],
        community_id=action.community_id,
    )
    db.add(post)
    db.flush()

    # Guardar el video_id para no repostear
    action.youtube_last_video_id = video["video_id"]


def _exec_vote_fact(action: BotAction, vote: str, db: Session) -> None:
    user_id = action.bot.user_id
    since = datetime.now(timezone.utc) - timedelta(hours=48)
    recent_posts = (
        db.query(Post)
        .filter(Post.created_at >= since, Post.user_id != user_id)
        .order_by(Post.created_at.desc())
        .limit(30).all()
    )
    voted_ids = {v.post_id for v in db.query(FactVote).filter(FactVote.user_id == user_id).all()}
    candidates = [p for p in recent_posts if p.id not in voted_ids]
    if not candidates:
        return
    target = random.choice(candidates[:10])
    db.add(FactVote(post_id=target.id, user_id=user_id, vote=vote))


def _exec_vote_debate(action: BotAction, side: str, db: Session) -> None:
    user_id = action.bot.user_id
    now = datetime.now(timezone.utc)
    active_debates = (
        db.query(Debate)
        .filter(Debate.status == "active", Debate.closes_at > now)
        .order_by(Debate.closes_at.asc()).limit(20).all()
    )
    voted_debate_ids = {v.debate_id for v in db.query(DebateVote).filter(DebateVote.user_id == user_id).all()}
    candidates = [d for d in active_debates if d.id not in voted_debate_ids]
    if not candidates:
        return
    target = random.choice(candidates[:5])
    db.add(DebateVote(debate_id=target.id, user_id=user_id, side=side))


ACTION_HANDLERS = {
    "post":          _exec_post,
    "youtube_post":  _exec_youtube_post,
    "vote_truth":    lambda a, db: _exec_vote_fact(a, "truth", db),
    "vote_fake":     lambda a, db: _exec_vote_fact(a, "fake", db),
    "vote_for":      lambda a, db: _exec_vote_debate(a, "for", db),
    "vote_against":  lambda a, db: _exec_vote_debate(a, "against", db),
}


# ── Job principal ───────────────────────────────────────────────────────────

def run_bot_actions() -> None:
    db: Session = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        actions = (
            db.query(BotAction)
            .join(Bot)
            .filter(Bot.is_active == True)
            .all()
        )
        for action in actions:
            # Respetar duración máxima del bot
            if action.bot.active_until and now > action.bot.active_until:
                logger.info(f"Bot {action.bot.user_id} expirado — omitiendo")
                continue

            if action.last_run is not None:
                due_at = action.last_run + timedelta(hours=action.frequency_hours)
                due_at += timedelta(minutes=random.uniform(-15, 15))
                if now < due_at:
                    continue

            handler = ACTION_HANDLERS.get(action.action_type)
            if not handler:
                continue

            try:
                handler(action, db)
                action.last_run = now
                # Registrar en run_log (últimas 20 ejecuciones)
                log = list(action.run_log or [])
                log.append(now.isoformat())
                action.run_log = log[-20:]
                db.commit()
                logger.info(f"Bot {action.bot.user_id} ejecutó '{action.action_type}'")
            except Exception as e:
                db.rollback()
                logger.warning(f"Error en acción {action.id} ({action.action_type}): {e}")

    except Exception as e:
        logger.error(f"Error en run_bot_actions: {e}")
    finally:
        db.close()


scheduler.add_job(run_bot_actions, "interval", minutes=5, id="bot_runner", replace_existing=True)
