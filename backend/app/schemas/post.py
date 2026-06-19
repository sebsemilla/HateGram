from pydantic import BaseModel, Field, field_validator
from typing import Optional
from datetime import datetime


class PostCreate(BaseModel):
    caption: Optional[str] = Field(default="", max_length=500)
    image_url: Optional[str] = Field(default="", max_length=2048)
    link_url: Optional[str] = Field(default="", max_length=2048)
    link_title: Optional[str] = Field(default="", max_length=200)
    link_description: Optional[str] = Field(default="", max_length=500)
    link_image: Optional[str] = Field(default="", max_length=2048)
    community_id: Optional[int] = None
    debate_hours: Optional[int] = None
    repost_of_id: Optional[int] = None

    @field_validator("debate_hours")
    @classmethod
    def debate_hours_valid(cls, v):
        if v is not None and v not in (24, 48, 72):
            raise ValueError("debate_hours debe ser 24, 48 o 72")
        return v


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
