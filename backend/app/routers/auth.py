from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.user import User
from app.models.profile import Profile
from app.schemas.user import UserRegister, UserLogin, Token, UserOut
from app.core.security import hash_password, verify_password, create_access_token

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
def register(data: UserRegister, db: Session = Depends(get_db)):
    if db.query(User).filter(User.username == data.username).first():
        raise HTTPException(status_code=400, detail="El username ya está en uso")
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(status_code=400, detail="El email ya está registrado")

    user = User(
        username=data.username,
        email=data.email,
        hashed_password=hash_password(data.password),
    )
    db.add(user)
    db.flush()

    profile = Profile(user_id=user.id, display_name=data.username)
    db.add(profile)
    db.commit()
    db.refresh(user)

    token = create_access_token({"sub": str(user.id)})
    return Token(access_token=token, user=UserOut.model_validate(user))


@router.post("/login", response_model=Token)
def login(data: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == data.username).first()
    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")

    token = create_access_token({"sub": str(user.id)})
    return Token(access_token=token, user=UserOut.model_validate(user))
