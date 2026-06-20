from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List

from app.db.database import get_db
from app.models.user import User
from app.models.user_interest import UserInterest, VALID_INTERESTS
from app.core.deps import get_current_user

router = APIRouter(prefix="/onboarding", tags=["onboarding"])

LIFETIME_LIMIT = 200


class InterestsPayload(BaseModel):
    interests: List[str]


@router.get("/beta-spots")
def beta_spots(db: Session = Depends(get_db)):
    """Cuántos lugares lifetime quedan de los primeros 200."""
    taken = db.query(User).filter(
        User.membership_type == "lifetime_pending",
        User.is_fictitious == False,
    ).count()
    remaining = max(0, LIFETIME_LIMIT - taken)
    return {"remaining": remaining, "limit": LIFETIME_LIMIT, "taken": taken}


@router.post("/interests")
def save_interests(
    payload: InterestsPayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not payload.interests:
        raise HTTPException(status_code=400, detail="Seleccioná al menos un interés")
    invalid = [i for i in payload.interests if i not in VALID_INTERESTS]
    if invalid:
        raise HTTPException(status_code=400, detail=f"Intereses inválidos: {invalid}")

    db.query(UserInterest).filter(UserInterest.user_id == current_user.id).delete()
    for interest in set(payload.interests):
        db.add(UserInterest(user_id=current_user.id, interest=interest))
    db.commit()
    return {"interests": list(set(payload.interests))}


@router.get("/interests")
def get_interests(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = db.query(UserInterest).filter(UserInterest.user_id == current_user.id).all()
    return {"interests": [r.interest for r in rows]}
