from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.user import User
from app.models.profile import Profile
from app.schemas.profile import ProfileOut, ProfileUpdate
from app.core.deps import get_current_user
from app.badges import get_user_badges

router = APIRouter(prefix="/profiles", tags=["profiles"])


def _build_profile_out(profile: Profile, db: Session | None = None) -> ProfileOut:
    badges = get_user_badges(profile.user_id, db) if db else []
    return ProfileOut(
        id=profile.id,
        user_id=profile.user_id,
        display_name=profile.display_name,
        bio=profile.bio or "",
        avatar_url=profile.avatar_url or "",
        banner_url=profile.banner_url or "",
        website=profile.website or "",
        location=profile.location or "",
        username=profile.user.username,
        badges=badges,
    )


@router.get("/me", response_model=ProfileOut)
def get_my_profile(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    profile = db.query(Profile).filter(Profile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Perfil no encontrado")
    return _build_profile_out(profile, db)


@router.patch("/me", response_model=ProfileOut)
def update_my_profile(
    data: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = db.query(Profile).filter(Profile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Perfil no encontrado")

    for field, value in data.model_dump(exclude_none=True).items():
        setattr(profile, field, value)

    db.commit()
    db.refresh(profile)
    return _build_profile_out(profile, db)


@router.get("/{username}", response_model=ProfileOut)
def get_profile(username: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == username).first()
    if not user or not user.profile:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return _build_profile_out(user.profile, db)


@router.get("/", response_model=list[ProfileOut])
def list_profiles(skip: int = 0, limit: int = 20, db: Session = Depends(get_db)):
    profiles = (
        db.query(Profile)
        .join(User)
        .filter(User.is_active == True)
        .offset(skip)
        .limit(limit)
        .all()
    )
    return [_build_profile_out(p, db) for p in profiles]
