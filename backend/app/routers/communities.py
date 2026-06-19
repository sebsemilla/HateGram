from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional
from pydantic import BaseModel, Field, field_validator
from app.db.database import get_db
from app.models.community import Community, Membership
from app.models.post import Post
from app.models.user import User
from app.core.deps import get_current_user, get_current_user_optional
from app.routers.posts import _build_post_out
from app.models.post_reaction import PostReaction

router = APIRouter(prefix="/communities", tags=["communities"])


# ── Schemas ────────────────────────────────────────────────────────────────

SLUG_RE = __import__("re").compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")

class CommunityCreate(BaseModel):
    name: str = Field(min_length=3, max_length=50)
    slug: str = Field(min_length=3, max_length=50)
    description: Optional[str] = Field(default="", max_length=300)
    image_url: Optional[str] = Field(default="", max_length=2048)

    @field_validator("slug")
    @classmethod
    def slug_valid(cls, v: str) -> str:
        if not SLUG_RE.match(v):
            raise ValueError("El slug solo puede contener letras minúsculas, números y guiones")
        return v


def _build_community(c: Community, member_count: int, is_member: bool) -> dict:
    return {
        "id": c.id,
        "slug": c.slug,
        "name": c.name,
        "description": c.description,
        "image_url": c.image_url,
        "type": c.type,
        "created_at": c.created_at.isoformat(),
        "member_count": member_count,
        "is_member": is_member,
    }


def _get_member_count(db: Session, community_id: int) -> int:
    return db.query(func.count(Membership.id)).filter(Membership.community_id == community_id).scalar()


def _is_member(db: Session, user_id: int, community_id: int) -> bool:
    return db.query(Membership).filter(
        Membership.user_id == user_id,
        Membership.community_id == community_id,
    ).first() is not None


# ── Endpoints ──────────────────────────────────────────────────────────────

@router.get("/")
def list_communities(
    type: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    q = db.query(Community).filter(Community.is_active == True)
    if type:
        q = q.filter(Community.type == type)
    if search:
        q = q.filter(Community.name.ilike(f"%{search}%"))
    communities = q.order_by(Community.created_at.asc()).all()

    return [
        _build_community(
            c,
            _get_member_count(db, c.id),
            _is_member(db, current_user.id, c.id) if current_user else False,
        )
        for c in communities
    ]


@router.get("/{slug}")
def get_community(
    slug: str,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    c = db.query(Community).filter(Community.slug == slug, Community.is_active == True).first()
    if not c:
        raise HTTPException(status_code=404, detail="Comunidad no encontrada")
    return _build_community(
        c,
        _get_member_count(db, c.id),
        _is_member(db, current_user.id, c.id) if current_user else False,
    )


@router.post("/", status_code=201)
def create_community(
    data: CommunityCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not current_user.is_verified and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Solo usuarios verificados pueden crear grupos")

    slug = data.slug.lower().replace(" ", "-")
    if db.query(Community).filter(Community.slug == slug).first():
        raise HTTPException(status_code=400, detail="Ya existe un grupo con ese slug")

    community = Community(
        slug=slug,
        name=data.name,
        description=data.description,
        image_url=data.image_url,
        type="fan",
        created_by=current_user.id,
    )
    db.add(community)
    db.flush()

    # El creador se une automáticamente
    db.add(Membership(user_id=current_user.id, community_id=community.id))
    db.commit()
    db.refresh(community)
    return _build_community(community, 1, True)


@router.post("/{slug}/join")
def join_community(
    slug: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    c = db.query(Community).filter(Community.slug == slug).first()
    if not c:
        raise HTTPException(status_code=404, detail="Comunidad no encontrada")
    if _is_member(db, current_user.id, c.id):
        raise HTTPException(status_code=400, detail="Ya sos miembro")
    db.add(Membership(user_id=current_user.id, community_id=c.id))
    db.commit()
    return {"message": "Te uniste a la comunidad", "member_count": _get_member_count(db, c.id)}


@router.delete("/{slug}/leave")
def leave_community(
    slug: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    c = db.query(Community).filter(Community.slug == slug).first()
    if not c:
        raise HTTPException(status_code=404, detail="Comunidad no encontrada")
    membership = db.query(Membership).filter(
        Membership.user_id == current_user.id,
        Membership.community_id == c.id,
    ).first()
    if not membership:
        raise HTTPException(status_code=400, detail="No sos miembro")
    db.delete(membership)
    db.commit()
    return {"message": "Saliste de la comunidad", "member_count": _get_member_count(db, c.id)}


@router.get("/{slug}/feed")
def community_feed(
    slug: str,
    sort: str = "new",   # new | top
    view: str = "all",   # all | own | tagged
    skip: int = 0,
    limit: int = 30,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    c = db.query(Community).filter(Community.slug == slug).first()
    if not c:
        raise HTTPException(status_code=404, detail="Comunidad no encontrada")

    q = (
        db.query(Post)
        .filter(Post.community_id == c.id)
        .join(User, Post.user_id == User.id)
        .filter(User.is_active == True)
    )

    if view == "own" and current_user:
        q = q.filter(Post.user_id == current_user.id)
    elif view == "tagged":
        q = q.filter(Post.caption.contains("#"))

    if sort == "top":
        q = (
            q.outerjoin(PostReaction, PostReaction.post_id == Post.id)
            .group_by(Post.id)
            .order_by(func.count(PostReaction.id).desc(), Post.created_at.desc())
        )
    else:
        q = q.order_by(Post.created_at.desc())

    posts = q.offset(skip).limit(limit).all()
    return [_build_post_out(p, current_user=current_user, db=db) for p in posts]
