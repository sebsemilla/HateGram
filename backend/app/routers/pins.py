from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.user import User
from app.models.pin import PinPost
from app.models.post import Post
from app.core.deps import get_current_user

router = APIRouter(prefix="/pins", tags=["pins"])

def _build_post_out(post: Post, user_id: int, db: Session) -> dict:
    from app.models.fact_vote import FactVote
    return {
        "id": post.id,
        "user_id": post.user_id,
        "username": post.user.username,
        "display_name": post.user.profile.display_name if post.user.profile else post.user.username,
        "avatar_url": post.user.profile.avatar_url if post.user.profile else "",
        "caption": post.caption or "",
        "image_url": post.image_url or "",
        "link_url": post.link_url or "",
        "link_title": post.link_title or "",
        "link_description": post.link_description or "",
        "link_image": post.link_image or "",
        "created_at": post.created_at.isoformat(),
        "is_pinned": True,
        "pin_count": db.query(PinPost).filter(PinPost.post_id == post.id).count(),
    }

@router.post("/{post_id}")
def toggle_pin(post_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    existing = db.query(PinPost).filter(PinPost.post_id == post_id, PinPost.user_id == current_user.id).first()
    if existing:
        db.delete(existing)
        db.commit()
        count = db.query(PinPost).filter(PinPost.post_id == post_id).count()
        return {"pinned": False, "pin_count": count}
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post no encontrado")
    pin = PinPost(user_id=current_user.id, post_id=post_id)
    db.add(pin)
    db.commit()
    count = db.query(PinPost).filter(PinPost.post_id == post_id).count()
    return {"pinned": True, "pin_count": count}

@router.get("/")
def my_pins(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    pins = (
        db.query(PinPost)
        .filter(PinPost.user_id == current_user.id)
        .order_by(PinPost.created_at.desc())
        .all()
    )
    return [_build_post_out(p.post, current_user.id, db) for p in pins]

@router.get("/user/{username}")
def user_pins(username: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    from app.models.user import User as UserModel
    user = db.query(UserModel).filter(UserModel.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    pins = (
        db.query(PinPost)
        .filter(PinPost.user_id == user.id)
        .order_by(PinPost.created_at.desc())
        .all()
    )
    return [_build_post_out(p.post, current_user.id, db) for p in pins]
