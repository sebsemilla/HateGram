from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional, List
from pydantic import BaseModel
from datetime import datetime
from app.db.database import get_db
from app.models.comment import Comment, CommentVote
from app.models.post import Post
from app.models.user import User
from app.core.deps import get_current_user, get_current_user_optional

router = APIRouter(prefix="/comments", tags=["comments"])


class CommentCreate(BaseModel):
    content: str
    parent_id: Optional[int] = None


class VoteCreate(BaseModel):
    vote: int  # +1 or -1


class CommentOut(BaseModel):
    id: int
    post_id: int
    user_id: int
    username: str
    display_name: str
    avatar_url: str
    content: str
    created_at: datetime
    parent_id: Optional[int] = None
    score: int
    my_vote: Optional[int] = None
    replies: List["CommentOut"] = []

    model_config = {"from_attributes": True}


CommentOut.model_rebuild()


def _build_comment_out(comment: Comment, current_user: Optional[User], db: Session) -> CommentOut:
    votes = db.query(CommentVote).filter(CommentVote.comment_id == comment.id).all()
    score = sum(v.vote for v in votes)
    my_vote = None
    if current_user:
        row = next((v for v in votes if v.user_id == current_user.id), None)
        my_vote = row.vote if row else None

    replies_raw = (
        db.query(Comment)
        .filter(Comment.parent_id == comment.id)
        .order_by(Comment.created_at.asc())
        .all()
    )
    replies = [_build_comment_out(r, current_user, db) for r in replies_raw]

    profile = comment.user.profile
    return CommentOut(
        id=comment.id,
        post_id=comment.post_id,
        user_id=comment.user_id,
        username=comment.user.username,
        display_name=profile.display_name if profile else comment.user.username,
        avatar_url=profile.avatar_url if profile else "",
        content=comment.content,
        created_at=comment.created_at,
        parent_id=comment.parent_id,
        score=score,
        my_vote=my_vote,
        replies=replies,
    )


@router.post("/{post_id}", response_model=CommentOut, status_code=201)
def create_comment(
    post_id: int,
    data: CommentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not data.content.strip():
        raise HTTPException(status_code=400, detail="El comentario no puede estar vacío")
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post no encontrado")
    if data.parent_id:
        parent = db.query(Comment).filter(
            Comment.id == data.parent_id, Comment.post_id == post_id
        ).first()
        if not parent:
            raise HTTPException(status_code=404, detail="Comentario padre no encontrado")
    comment = Comment(
        post_id=post_id,
        user_id=current_user.id,
        content=data.content.strip(),
        parent_id=data.parent_id,
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return _build_comment_out(comment, current_user, db)


@router.get("/{post_id}", response_model=list[CommentOut])
def get_comments(
    post_id: int,
    sort: str = "top",
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    comments = (
        db.query(Comment)
        .filter(Comment.post_id == post_id, Comment.parent_id == None)
        .all()
    )
    result = [_build_comment_out(c, current_user, db) for c in comments]
    if sort == "new":
        result.sort(key=lambda c: c.created_at, reverse=True)
    else:
        result.sort(key=lambda c: c.score, reverse=True)
    return result


@router.delete("/{comment_id}", status_code=204)
def delete_comment(
    comment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    comment = db.query(Comment).filter(
        Comment.id == comment_id, Comment.user_id == current_user.id
    ).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comentario no encontrado")
    db.delete(comment)
    db.commit()


@router.post("/{comment_id}/vote", response_model=CommentOut)
def vote_comment(
    comment_id: int,
    data: VoteCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if data.vote not in (1, -1):
        raise HTTPException(status_code=400, detail="Voto debe ser 1 o -1")
    comment = db.query(Comment).filter(Comment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comentario no encontrado")
    existing = db.query(CommentVote).filter(
        CommentVote.comment_id == comment_id, CommentVote.user_id == current_user.id
    ).first()
    if existing:
        if existing.vote == data.vote:
            db.delete(existing)
        else:
            existing.vote = data.vote
        db.commit()
    else:
        db.add(CommentVote(comment_id=comment_id, user_id=current_user.id, vote=data.vote))
        db.commit()
    db.refresh(comment)
    return _build_comment_out(comment, current_user, db)
