from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.user import User
from app.models.follow import Follow
from app.core.deps import get_current_user
from app.core.notif import push

router = APIRouter(prefix="/follow", tags=["follow"])

@router.post("/{username}")
def toggle_follow(username: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    target = db.query(User).filter(User.username == username).first()
    if not target:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if target.id == current_user.id:
        raise HTTPException(status_code=400, detail="No podés seguirte a vos mismo")
    existing = db.query(Follow).filter(Follow.follower_id == current_user.id, Follow.following_id == target.id).first()
    if existing:
        db.delete(existing)
        db.commit()
        followers = db.query(Follow).filter(Follow.following_id == target.id).count()
        return {"following": False, "follower_count": followers}
    follow = Follow(follower_id=current_user.id, following_id=target.id)
    db.add(follow)
    push(db, user_id=target.id, actor_id=current_user.id,
         type="follow", body=f"{current_user.username} te empezó a seguir",
         entity_type="profile", entity_id=current_user.id,
         link=f"/profile/{current_user.username}")
    db.commit()
    followers = db.query(Follow).filter(Follow.following_id == target.id).count()
    return {"following": True, "follower_count": followers}

@router.get("/status/{username}")
def follow_status(username: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    target = db.query(User).filter(User.username == username).first()
    if not target:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    is_following = db.query(Follow).filter(
        Follow.follower_id == current_user.id, Follow.following_id == target.id
    ).first() is not None
    follower_count = db.query(Follow).filter(Follow.following_id == target.id).count()
    following_count = db.query(Follow).filter(Follow.follower_id == target.id).count()
    return {"following": is_following, "follower_count": follower_count, "following_count": following_count}
