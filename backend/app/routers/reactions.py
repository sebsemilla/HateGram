from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel
from app.db.database import get_db
from app.models.post_reaction import PostReaction
from app.models.post import Post
from app.models.user import User
from app.core.deps import get_current_user, get_current_user_optional
from app.core.notif import push
from app.models.notification import Notification

router = APIRouter(prefix="/posts", tags=["reactions"])

VALID_REACTIONS = {"heart", "fire", "cringe", "cope", "based", "dead"}


class ReactionCreate(BaseModel):
    reaction_type: str


def _build_reactions_out(post_id: int, current_user: Optional[User], db: Session):
    reactions = db.query(PostReaction).filter(PostReaction.post_id == post_id).all()
    counts: dict = {r: 0 for r in VALID_REACTIONS}
    my_reaction = None
    for r in reactions:
        counts[r.reaction_type] = counts.get(r.reaction_type, 0) + 1
        if current_user and r.user_id == current_user.id:
            my_reaction = r.reaction_type
    return {"counts": counts, "my_reaction": my_reaction, "total": sum(counts.values())}


@router.get("/{post_id}/reactions")
def get_reactions(
    post_id: int,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    return _build_reactions_out(post_id, current_user, db)


@router.post("/{post_id}/reactions")
def toggle_reaction(
    post_id: int,
    data: ReactionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if data.reaction_type not in VALID_REACTIONS:
        raise HTTPException(status_code=400, detail="Reacción inválida")
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post no encontrado")
    existing = db.query(PostReaction).filter(
        PostReaction.post_id == post_id, PostReaction.user_id == current_user.id
    ).first()
    if existing:
        if existing.reaction_type == data.reaction_type:
            db.delete(existing)
        else:
            existing.reaction_type = data.reaction_type
        db.commit()
    else:
        db.add(PostReaction(post_id=post_id, user_id=current_user.id, reaction_type=data.reaction_type))
        # Notificar solo en la primera reacción al autor
        if post.user_id != current_user.id:
            existing_notif = db.query(Notification).filter_by(
                user_id=post.user_id, actor_id=current_user.id, type="reaction", entity_id=post_id
            ).first()
            if not existing_notif:
                push(db, user_id=post.user_id, actor_id=current_user.id,
                     type="reaction", body=f"{current_user.username} reaccionó a tu post",
                     entity_type="post", entity_id=post_id, link="/feed")
        db.commit()
    return _build_reactions_out(post_id, current_user, db)
