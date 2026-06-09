from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class PostCreate(BaseModel):
    caption: Optional[str] = ""
    image_url: Optional[str] = ""
    link_url: Optional[str] = ""
    link_title: Optional[str] = ""
    link_description: Optional[str] = ""
    link_image: Optional[str] = ""
    community_id: Optional[int] = None
    debate_hours: Optional[int] = None  # 24 | 48 | 72 — activa debate al publicar
    repost_of_id: Optional[int] = None


class PostOut(BaseModel):
    id: int
    user_id: int
    username: str
    display_name: str
    avatar_url: str
    caption: str
    image_url: str
    link_url: str
    link_title: str
    link_description: str
    link_image: str
    community_id: Optional[int] = None
    community_slug: Optional[str] = None
    community_name: Optional[str] = None
    created_at: datetime
    pin_count: Optional[int] = 0
    is_pinned: Optional[bool] = False
    repost_of_id: Optional[int] = None
    repost_of_username: Optional[str] = None
    repost_of_display_name: Optional[str] = None
    repost_count: Optional[int] = 0

    model_config = {"from_attributes": True}
