import secrets
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from authlib.integrations.httpx_client import AsyncOAuth2Client

from app.db.database import get_db
from app.models.user import User
from app.models.profile import Profile
from app.models.revoked_token import RevokedToken
from app.schemas.user import UserRegister, UserLogin, Token, UserOut
from app.core.security import hash_password, verify_password, create_access_token, decode_token
from app.core.config import settings
from app.core.deps import get_current_user
from app.core.email import send_verification_email, send_reset_email

router = APIRouter(prefix="/auth", tags=["auth"])

RESET_TOKEN_TTL_MINUTES = 30
VERIFY_TOKEN_TTL_HOURS = 24

GOOGLE_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"


# ── Registro ─────────────────────────────────────────────────────────────────

@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
def register(data: UserRegister, db: Session = Depends(get_db)):
    if db.query(User).filter(User.username == data.username).first():
        raise HTTPException(status_code=400, detail="El username ya está en uso")
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(status_code=400, detail="El email ya está registrado")

    verify_token = secrets.token_urlsafe(32)
    verify_expires = datetime.now(timezone.utc) + timedelta(hours=VERIFY_TOKEN_TTL_HOURS)

    user = User(
        username=data.username,
        email=data.email,
        hashed_password=hash_password(data.password),
        reset_token=verify_token,
        reset_token_expires=verify_expires,
    )
    db.add(user)
    db.flush()

    profile = Profile(user_id=user.id, display_name=data.username)
    db.add(profile)
    db.commit()
    db.refresh(user)

    send_verification_email(data.email, data.username, verify_token)

    token = create_access_token({"sub": str(user.id)})
    return Token(access_token=token, user=UserOut.model_validate(user))


# ── Verificación de email ────────────────────────────────────────────────────

@router.get("/verify-email")
def verify_email(token: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.reset_token == token).first()
    if not user or not user.reset_token_expires:
        raise HTTPException(status_code=400, detail="Token inválido o expirado")

    expires = user.reset_token_expires
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if datetime.now(timezone.utc) > expires:
        raise HTTPException(status_code=400, detail="El token de verificación ha expirado")

    user.is_verified = True
    user.reset_token = None
    user.reset_token_expires = None
    db.commit()

    return RedirectResponse(url=f"{settings.FRONTEND_URL}/login?verified=1")


# ── Login ────────────────────────────────────────────────────────────────────

@router.post("/login", response_model=Token)
def login(data: UserLogin, db: Session = Depends(get_db)):
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
    if not user or not user.is_active:
        return {"message": "Si el email existe, recibirás instrucciones para resetear tu contraseña."}

    token = secrets.token_urlsafe(32)
    user.reset_token = token
    user.reset_token_expires = datetime.now(timezone.utc) + timedelta(minutes=RESET_TOKEN_TTL_MINUTES)
    db.commit()

    sent = send_reset_email(user.email, user.username, token)

    response = {"message": "Si el email existe, recibirás instrucciones para resetear tu contraseña."}
    if not sent:
        response["dev_token"] = token
    return response


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

    expires = user.reset_token_expires
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if datetime.now(timezone.utc) > expires:
        raise HTTPException(status_code=400, detail="El token de reset ha expirado")

    user.hashed_password = hash_password(data.new_password)
    user.reset_token = None
    user.reset_token_expires = None
    db.commit()

    return {"message": "Contraseña actualizada correctamente"}


# ── Logout ───────────────────────────────────────────────────────────────────

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
            expires_at = datetime.fromtimestamp(exp, tz=timezone.utc)
            if not db.query(RevokedToken).filter(RevokedToken.jti == jti).first():
                db.add(RevokedToken(jti=jti, expires_at=expires_at))
                db.commit()
    except Exception:
        pass

    return {"message": "Sesión cerrada correctamente"}


# ── Google OAuth ─────────────────────────────────────────────────────────────

@router.get("/google")
async def google_login():
    redirect_uri = f"{settings.FRONTEND_URL.replace('3000', '8000')}/auth/google/callback"
    async with AsyncOAuth2Client(
        client_id=settings.GOOGLE_CLIENT_ID,
        redirect_uri=redirect_uri,
    ) as client:
        uri, _ = client.create_authorization_url(
            GOOGLE_AUTHORIZE_URL,
            scope="openid email profile",
        )
    return RedirectResponse(url=uri)


@router.get("/google/callback")
async def google_callback(code: str, db: Session = Depends(get_db)):
    redirect_uri = f"http://localhost:8000/auth/google/callback"
    async with AsyncOAuth2Client(
        client_id=settings.GOOGLE_CLIENT_ID,
        client_secret=settings.GOOGLE_CLIENT_SECRET,
        redirect_uri=redirect_uri,
    ) as client:
        token_data = await client.fetch_token(GOOGLE_TOKEN_URL, code=code)
        resp = await client.get(GOOGLE_USERINFO_URL)
        info = resp.json()

    google_email = info.get("email", "").lower()
    google_name = info.get("name", "")
    google_picture = info.get("picture", "")
    google_sub = info.get("sub", "")

    if not google_email:
        raise HTTPException(status_code=400, detail="No se pudo obtener el email de Google")

    # Buscar usuario existente por email
    user = db.query(User).filter(User.email == google_email).first()

    if not user:
        # Crear usuario nuevo
        base_username = google_email.split("@")[0].lower()
        base_username = "".join(c for c in base_username if c.isalnum() or c == "_")[:25]
        username = base_username
        suffix = 1
        while db.query(User).filter(User.username == username).first():
            username = f"{base_username}{suffix}"
            suffix += 1

        user = User(
            username=username,
            email=google_email,
            hashed_password=hash_password(secrets.token_hex(16)),
            is_verified=True,
            is_active=True,
        )
        db.add(user)
        db.flush()

        profile = Profile(
            user_id=user.id,
            display_name=google_name or username,
            avatar_url=google_picture,
        )
        db.add(profile)
        db.commit()
        db.refresh(user)
    else:
        # Marcar como verificado si no lo estaba
        if not user.is_verified:
            user.is_verified = True
            db.commit()

    token = create_access_token({"sub": str(user.id)})
    frontend_redirect = f"{settings.FRONTEND_URL}/auth/callback?token={token}&user={UserOut.model_validate(user).model_dump_json()}"
    return RedirectResponse(url=frontend_redirect)
