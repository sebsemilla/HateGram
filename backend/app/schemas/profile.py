from pydantic import BaseModel
from typing import Optional


class ProfileUpdate(BaseModel):
    display_name: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    banner_url: Optional[str] = None
    website: Optional[str] = None
    location: Optional[str] = None


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

    model_config = {"from_attributes": True}
