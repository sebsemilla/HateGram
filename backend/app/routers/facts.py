from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from app.db.database import get_db
from app.models.fact_vote import FactVote
from app.models.post import Post
from app.models.user import User
from app.core.deps import get_current_user

router = APIRouter(prefix="/facts", tags=["facts"])


def _get_results(db: Session, post_id: int, user_id: int | None = None) -> dict:
    truth = db.query(func.count(FactVote.id)).filter(
        FactVote.post_id == post_id, FactVote.vote == "truth"
    ).scalar()
    fake = db.query(func.count(FactVote.id)).filter(
        FactVote.post_id == post_id, FactVote.vote == "fake"
    ).scalar()
    total = truth + fake

    my_vote = None
    if user_id:
        v = db.query(FactVote).filter(FactVote.post_id == post_id, FactVote.user_id == user_id).first()
        my_vote = v.vote if v else None

    return {
        "truth": truth,
        "fake": fake,
        "total": total,
        "truth_pct": round(truth / total * 100) if total else 0,
        "fake_pct": round(fake / total * 100) if total else 0,
        "my_vote": my_vote,
    }


@router.get("/{post_id}")
def get_fact_results(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not db.query(Post).filter(Post.id == post_id).first():
        raise HTTPException(status_code=404, detail="Post no encontrado")
    return _get_results(db, post_id, current_user.id)


class VoteIn(BaseModel):
    vote: str  # "truth" | "fake"


@router.post("/{post_id}")
def vote_fact(
    post_id: int,
    data: VoteIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if data.vote not in ("truth", "fake"):
        raise HTTPException(status_code=400, detail="Voto inválido")
    if not db.query(Post).filter(Post.id == post_id).first():
        raise HTTPException(status_code=404, detail="Post no encontrado")

    existing = db.query(FactVote).filter(
        FactVote.post_id == post_id, FactVote.user_id == current_user.id
    ).first()

    if existing:
        if existing.vote == data.vote:
            # Quitar voto
            db.delete(existing)
        else:
            # Cambiar voto
            existing.vote = data.vote
    else:
        db.add(FactVote(post_id=post_id, user_id=current_user.id, vote=data.vote))

    db.commit()
    return _get_results(db, post_id, current_user.id)
