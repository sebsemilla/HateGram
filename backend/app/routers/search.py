from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional

from app.db.database import get_db
from app.models.user import User
from app.models.profile import Profile
from app.models.post import Post
from app.models.follow import Follow
from app.core.deps import get_current_user_optional

router = APIRouter(prefix="/search", tags=["search"])

API_URL = "http://localhost:8000"


def _user_out(user: User, current_user: Optional[User], db: Session) -> dict:
    profile = user.profile
    is_following = False
    if current_user and current_user.id != user.id:
        is_following = db.query(Follow).filter(
            Follow.follower_id == current_user.id,
            Follow.following_id == user.id,
        ).first() is not None
    avatar = (profile.avatar_url or "") if profile else ""
    if avatar and not avatar.startswith("http"):
        avatar = f"{API_URL}{avatar}"
    return {
        "id": user.id,
        "username": user.username,
        "display_name": profile.display_name if profile else user.username,
        "avatar_url": avatar,
        "bio": (profile.bio or "") if profile else "",
        "is_following": is_following,
    }


def _post_out(post: Post, db: Session) -> dict:
    user = post.user
    profile = user.profile if user else None
    avatar = (profile.avatar_url or "") if profile else ""
    if avatar and not avatar.startswith("http"):
        avatar = f"{API_URL}{avatar}"
    return {
        "id": post.id,
        "caption": post.caption or "",
        "image_url": post.image_url or "",
        "created_at": post.created_at.isoformat(),
        "user_id": post.user_id,
        "username": user.username if user else "",
        "display_name": profile.display_name if profile else (user.username if user else ""),
        "avatar_url": avatar,
    }


@router.get("/")
def search(
    q: str = Query("", min_length=0),
    type: str = Query("all"),  # "users" | "posts" | "all"
    limit: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    q = q.strip()
    if not q:
        return {"users": [], "posts": []}

    results: dict = {"users": [], "posts": []}

    if type in ("users", "all"):
        users = (
            db.query(User)
            .join(Profile, Profile.user_id == User.id, isouter=True)
            .filter(
                User.is_active == True,
                (
                    User.username.ilike(f"%{q}%") |
                    Profile.display_name.ilike(f"%{q}%")
                ),
            )
            .limit(limit)
            .all()
        )
        results["users"] = [_user_out(u, current_user, db) for u in users]

    if type in ("posts", "all"):
        posts = (
            db.query(Post)
            .filter(
                Post.caption.ilike(f"%{q}%"),
                Post.repost_of_id == None,
            )
            .order_by(Post.created_at.desc())
            .limit(limit)
            .all()
        )
        results["posts"] = [_post_out(p, db) for p in posts]

    return results
