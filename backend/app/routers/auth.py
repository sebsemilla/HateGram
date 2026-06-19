import secrets
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.user import User
from app.models.profile import Profile
from app.models.revoked_token import RevokedToken
from app.schemas.user import UserRegister, UserLogin, Token, UserOut
from app.core.security import hash_password, verify_password, create_access_token, decode_token
from app.core.config import settings
from app.core.deps import get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])

RESET_TOKEN_TTL_MINUTES = 30


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
    # Acepta username o email en el campo "username"
    identifier = data.username.strip()
    if "@" in identifier:
        user = db.query(User).filter(User.email == identifier).first()
    else:
        user = db.query(User).filter(User.username == identifier.lower()).first()

    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")

    token = create_access_token({"sub": str(user.id)})
    return Token(access_token=token, user=UserOut.model_validate(user))


# ── Password reset ───────────────────────────────────────────────────────────

class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


@router.post("/forgot-password", status_code=200)
def forgot_password(data: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email.strip().lower()).first()
    # Siempre responder igual para no revelar si el email existe
    if not user or not user.is_active:
        return {"message": "Si el email existe, recibirás instrucciones para resetear tu contraseña."}

    token = secrets.token_urlsafe(32)
    user.reset_token = token
    user.reset_token_expires = datetime.now(timezone.utc) + timedelta(minutes=RESET_TOKEN_TTL_MINUTES)
    db.commit()

    # En producción aquí se enviaría un email con el link de reset.
    # Por ahora se devuelve el token directamente para uso en desarrollo.
    reset_link = f"/reset-password?token={token}"
    return {
        "message": "Si el email existe, recibirás instrucciones para resetear tu contraseña.",
        "dev_reset_link": reset_link,
        "dev_token": token,
    }


@router.post("/reset-password", status_code=200)
def reset_password(data: ResetPasswordRequest, db: Session = Depends(get_db)):
    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="La contraseña debe tener al menos 6 caracteres")
    if not any(c.isdigit() for c in data.new_password):
        raise HTTPException(status_code=400, detail="La contraseña debe contener al menos un número")
    if not any(c.isalpha() for c in data.new_password):
        raise HTTPException(status_code=400, detail="La contraseña debe contener al menos una letra")

    user = db.query(User).filter(User.reset_token == data.token).first()
    if not user or not user.reset_token_expires:
        raise HTTPException(status_code=400, detail="Token inválido o expirado")

    now = datetime.now(timezone.utc)
    expires = user.reset_token_expires
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if now > expires:
        raise HTTPException(status_code=400, detail="El token de reset ha expirado")

    user.hashed_password = hash_password(data.new_password)
    user.reset_token = None
    user.reset_token_expires = None
    db.commit()

    return {"message": "Contraseña actualizada correctamente"}


# ── Logout (revoca el token actual) ─────────────────────────────────────────

@router.post("/logout", status_code=200)
def logout(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    auth_header = request.headers.get("Authorization", "")
    token = auth_header.removeprefix("Bearer ").strip()
    if not token:
        return {"message": "Sesión cerrada"}

    try:
        payload = decode_token(token)
        jti = payload.get("jti")
        exp = payload.get("exp")
        if jti and exp:
            from datetime import timezone
            expires_at = datetime.fromtimestamp(exp, tz=timezone.utc)
            if not db.query(RevokedToken).filter(RevokedToken.jti == jti).first():
                db.add(RevokedToken(jti=jti, expires_at=expires_at))
                db.commit()
    except Exception:
        pass

    return {"message": "Sesión cerrada correctamente"}
