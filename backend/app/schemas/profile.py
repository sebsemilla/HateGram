from pydantic import BaseModel, Field, field_validator
from typing import Optional


class ProfileUpdate(BaseModel):
    display_name: Optional[str] = Field(default=None, min_length=1, max_length=50)
    bio: Optional[str] = Field(default=None, max_length=500)
    avatar_url: Optional[str] = Field(default=None, max_length=2048)
    banner_url: Optional[str] = Field(default=None, max_length=2048)
    website: Optional[str] = Field(default=None, max_length=200)
    location: Optional[str] = Field(default=None, max_length=100)


class BadgeOut(BaseModel):
    slug: str
    name: str
    description: str
    icon: str
    color: str
    score: int


class ProfileOut(BaseModel):
    id: int
    user_id: int
    display_name: str
    bio: str
    avatar_url: str
    banner_url: str
    website: str
    location: str
    username: str
    follower_count: int = 0
    following_count: int = 0
    badges: list[BadgeOut] = []
    is_fictitious: bool = False
    bot_id: Optional[int] = None

    model_config = {"from_attributes": True}
