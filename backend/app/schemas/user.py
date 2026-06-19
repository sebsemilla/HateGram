import re
from pydantic import BaseModel, EmailStr, Field, field_validator
from datetime import datetime

USERNAME_RE = re.compile(r"^[a-zA-Z0-9_]+$")


class UserRegister(BaseModel):
    username: str = Field(min_length=3, max_length=30)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)

    @field_validator("username")
    @classmethod
    def username_valid(cls, v: str) -> str:
        if not USERNAME_RE.match(v):
            raise ValueError("El username solo puede contener letras, números y guiones bajos")
        return v.lower()

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if not any(c.isdigit() for c in v):
            raise ValueError("La contraseña debe contener al menos un número")
        if not any(c.isalpha() for c in v):
            raise ValueError("La contraseña debe contener al menos una letra")
        return v


class UserLogin(BaseModel):
    username: str  # puede ser username o email
    password: str


class UserOut(BaseModel):
    id: int
    username: str
    email: str
    is_admin: bool = False
    created_at: datetime

    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
