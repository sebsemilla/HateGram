from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from datetime import datetime, timezone, timedelta
from app.db.database import get_db
from app.models.debate import Debate, DebateVote
from app.models.post import Post
from app.models.user import User
from app.core.deps import get_current_user

router = APIRouter(prefix="/debates", tags=["debates"])

DURATION_OPTIONS = {24: 24, 48: 48, 72: 72}  # horas


def _build_debate(debate: Debate, db: Session, user_id: int | None = None) -> dict:
    total = len(debate.votes)
    for_count = sum(1 for v in debate.votes if v.side == "for")
    against_count = total - for_count

    my_vote = None
    if user_id:
        v = db.query(DebateVote).filter(
            DebateVote.debate_id == debate.id, DebateVote.user_id == user_id
        ).first()
        my_vote = v.side if v else None

    now = datetime.now(timezone.utc)
    is_expired = debate.closes_at < now

    winner = None
    if is_expired or debate.status == "closed":
        if for_count > against_count:
            winner = "for"
        elif against_count > for_count:
            winner = "against"
        else:
            winner = "tie"

    return {
        "id": debate.id,
        "post_id": debate.post_id,
        "status": "closed" if is_expired else debate.status,
        "closes_at": debate.closes_at.isoformat(),
        "for_count": for_count,
        "against_count": against_count,
        "total": total,
        "for_pct": round(for_count / total * 100) if total else 0,
        "against_pct": round(against_count / total * 100) if total else 0,
        "my_vote": my_vote,
        "winner": winner,
    }


@router.get("/{post_id}")
def get_debate(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    debate = db.query(Debate).filter(Debate.post_id == post_id).first()
    if not debate:
        return None
    return _build_debate(debate, db, current_user.id)


class DebateCreate(BaseModel):
    duration_hours: int = 24


@router.post("/{post_id}")
def create_debate(
    post_id: int,
    data: DebateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post no encontrado")
    if post.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Solo el autor puede abrir un debate")
    if db.query(Debate).filter(Debate.post_id == post_id).first():
        raise HTTPException(status_code=400, detail="Este post ya tiene un debate")
    if data.duration_hours not in DURATION_OPTIONS:
        raise HTTPException(status_code=400, detail="Duración inválida. Opciones: 24, 48, 72 horas")

    # Ventana de 24h: solo se puede activar debate dentro de las primeras 24h del post
    post_age = datetime.now(timezone.utc) - post.created_at.replace(tzinfo=timezone.utc)
    if post_age.total_seconds() > 86400 and not current_user.is_admin:
        raise HTTPException(status_code=400, detail="Solo podés activar un debate dentro de las primeras 24 horas del post")

    debate = Debate(
        post_id=post_id,
        created_by=current_user.id,
        closes_at=datetime.now(timezone.utc) + timedelta(hours=data.duration_hours),
    )
    db.add(debate)
    db.commit()
    db.refresh(debate)
    return _build_debate(debate, db, current_user.id)


class DebateVoteIn(BaseModel):
    side: str  # "for" | "against"


@router.post("/{post_id}/vote")
def vote_debate(
    post_id: int,
    data: DebateVoteIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if data.side not in ("for", "against"):
        raise HTTPException(status_code=400, detail="Lado inválido")

    debate = db.query(Debate).filter(Debate.post_id == post_id).first()
    if not debate:
        raise HTTPException(status_code=404, detail="No hay debate en este post")
    if debate.closes_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="El debate ya cerró")

    existing = db.query(DebateVote).filter(
        DebateVote.debate_id == debate.id, DebateVote.user_id == current_user.id
    ).first()

    if existing:
        if existing.side == data.side:
            db.delete(existing)
        else:
            existing.side = data.side
    else:
        db.add(DebateVote(debate_id=debate.id, user_id=current_user.id, side=data.side))

    db.commit()
    db.refresh(debate)
    return _build_debate(debate, db, current_user.id)
