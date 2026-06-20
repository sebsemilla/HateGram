from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timezone, timedelta
from typing import Optional
from app.db.database import get_db
from app.models.post import Post
from app.models.community import Membership
from app.models.user import User
from app.models.debate import Debate
from app.models.pin import PinPost
from app.schemas.post import PostCreate, PostOut
from app.core.deps import get_current_user
from app.core.notif import push

router = APIRouter(prefix="/posts", tags=["posts"])


def _build_post_out(post: Post, current_user: Optional[User] = None, db: Optional[Session] = None) -> PostOut:
    profile = post.user.profile
    pin_count = 0
    is_pinned = False
    repost_count = 0
    if db is not None:
        pin_count = db.query(PinPost).filter(PinPost.post_id == post.id).count()
        repost_count = db.query(Post).filter(Post.repost_of_id == post.id).count()
        if current_user is not None:
            is_pinned = db.query(PinPost).filter(
                PinPost.post_id == post.id, PinPost.user_id == current_user.id
            ).first() is not None

    # Info del post original si es repost
    repost_of_username = None
    repost_of_display_name = None
    if post.repost_of:
        orig = post.repost_of
        repost_of_username = orig.user.username if orig.user else None
        repost_of_display_name = (orig.user.profile.display_name if orig.user and orig.user.profile else repost_of_username)

    return PostOut(
        id=post.id,
        user_id=post.user_id,
        username=post.user.username,
        display_name=profile.display_name if profile else post.user.username,
        avatar_url=profile.avatar_url if profile else "",
        caption=post.caption or "",
        image_url=post.image_url or "",
        link_url=post.link_url or "",
        link_title=post.link_title or "",
        link_description=post.link_description or "",
        link_image=post.link_image or "",
        community_id=post.community_id,
        community_slug=post.community.slug if post.community else None,
        community_name=post.community.name if post.community else None,
        created_at=post.created_at,
        pin_count=pin_count,
        is_pinned=is_pinned,
        repost_of_id=post.repost_of_id,
        repost_of_username=repost_of_username,
        repost_of_display_name=repost_of_display_name,
        repost_count=repost_count,
    )


@router.post("/", response_model=PostOut, status_code=201)
def create_post(
    data: PostCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not data.image_url and not data.link_url and not data.caption:
        raise HTTPException(status_code=400, detail="El post debe tener al menos una imagen, link o texto")

    # Verificar membresía si se elige una comunidad
    if data.community_id:
        is_member = db.query(Membership).filter(
            Membership.user_id == current_user.id,
            Membership.community_id == data.community_id,
        ).first()
        if not is_member and not current_user.is_admin:
            raise HTTPException(status_code=403, detail="Debés ser miembro para publicar en esta comunidad")

    # Si es repost, copiar contenido del original
    repost_of_id = None
    if data.repost_of_id:
        original = db.query(Post).filter(Post.id == data.repost_of_id).first()
        if not original:
            raise HTTPException(status_code=404, detail="Post original no encontrado")
        repost_of_id = original.id
        # Usar contenido del original si no se provee caption propio
        if not data.caption:
            data.caption = original.caption
        if not data.image_url:
            data.image_url = original.image_url
        if not data.link_url:
            data.link_url = original.link_url
            data.link_title = original.link_title
            data.link_description = original.link_description
            data.link_image = original.link_image

    post = Post(
        user_id=current_user.id,
        caption=data.caption,
        image_url=data.image_url,
        link_url=data.link_url,
        link_title=data.link_title,
        link_description=data.link_description,
        link_image=data.link_image,
        community_id=data.community_id or None,
        repost_of_id=repost_of_id,
    )
    db.add(post)
    db.flush()

    # Notificar al autor original si es repost
    if repost_of_id:
        original = db.query(Post).filter(Post.id == repost_of_id).first()
        if original:
            push(db, user_id=original.user_id, actor_id=current_user.id,
                 type="repost", body=f"{current_user.username} reposteó tu publicación",
                 entity_type="post", entity_id=original.id, link="/feed")

    db.commit()
    db.refresh(post)

    # Crear debate automáticamente si se pidió al publicar
    if data.debate_hours in (24, 48, 72):
        debate = Debate(
            post_id=post.id,
            created_by=current_user.id,
            closes_at=datetime.now(timezone.utc) + timedelta(hours=data.debate_hours),
        )
        db.add(debate)
        db.commit()

    return _build_post_out(post, current_user=current_user, db=db)


@router.get("/user/{username}", response_model=list[PostOut])
def get_user_posts(username: str, skip: int = 0, limit: int = 30, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    posts = (
        db.query(Post)
        .filter(Post.user_id == user.id)
        .order_by(Post.created_at.desc())
        .offset(skip).limit(limit)
        .all()
    )
    return [_build_post_out(p, db=db) for p in posts]


@router.get("/feed", response_model=list[PostOut])
def get_feed(skip: int = 0, limit: int = 30, db: Session = Depends(get_db)):
    posts = (
        db.query(Post)
        .join(User)
        .filter(User.is_active == True)
        .order_by(Post.created_at.desc())
        .offset(skip).limit(limit)
        .all()
    )
    return [_build_post_out(p, db=db) for p in posts]


@router.get("/mine/with-media", response_model=list[PostOut])
def get_my_posts_with_media(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Posts propios que tienen imagen, para el picker de stories."""
    posts = (
        db.query(Post)
        .filter(Post.user_id == current_user.id, Post.image_url != "", Post.image_url != None)
        .order_by(Post.created_at.desc())
        .limit(60)
        .all()
    )
    return [_build_post_out(p, current_user=current_user, db=db) for p in posts]


@router.delete("/{post_id}", status_code=204)
def delete_post(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    post = db.query(Post).filter(Post.id == post_id, Post.user_id == current_user.id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post no encontrado")
    db.delete(post)
    db.commit()
