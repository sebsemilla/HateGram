from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from pydantic import BaseModel
from typing import Optional

from app.db.database import get_db
from app.models.story import Story
from app.models.follow import Follow
from app.models.user import User
from app.core.deps import get_current_user

router = APIRouter(prefix="/stories", tags=["stories"])


class StoryCreate(BaseModel):
    media_url: str
    media_type: str = "image"       # "image" | "video"
    caption: str = ""
    hashtag: str = ""
    link_url: str = ""
    link_image: str = ""
    publish_at: Optional[datetime] = None   # None = publicar inmediatamente


class StoryItem(BaseModel):
    id: int
    media_url: str
    media_type: str
    caption: str
    hashtag: str
    link_url: str
    link_image: str
    created_at: datetime
    publish_at: Optional[datetime]

    class Config:
        from_attributes = True


class StoryGroup(BaseModel):
    user_id: int
    username: str
    avatar_url: str
    stories: list[StoryItem]
    latest_at: datetime


@router.post("/", status_code=201)
def create_story(
    data: StoryCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if data.media_type not in ("image", "video"):
        raise HTTPException(status_code=400, detail="media_type debe ser 'image' o 'video'")

    story = Story(
        user_id=current_user.id,
        media_url=data.media_url,
        media_type=data.media_type,
        caption=data.caption,
        hashtag=data.hashtag,
        link_url=data.link_url,
        link_image=data.link_image,
        publish_at=data.publish_at,
    )
    db.add(story)
    db.commit()
    db.refresh(story)
    return {"id": story.id, "expires_at": story.expires_at, "publish_at": story.publish_at}


@router.get("/feed", response_model=list[StoryGroup])
def get_story_feed(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    now = datetime.now(timezone.utc)

    following_ids = (
        db.query(Follow.following_id)
        .filter(Follow.follower_id == current_user.id)
        .subquery()
    )

    # Stories activas + ya publicadas (publish_at nulo o pasado)
    stories = (
        db.query(Story)
        .filter(
            Story.user_id.in_(following_ids),
            Story.expires_at > now,
            (Story.publish_at == None) | (Story.publish_at <= now),
        )
        .order_by(Story.user_id, Story.created_at.desc())
        .all()
    )

    groups: dict[int, StoryGroup] = {}
    for s in stories:
        if s.user_id not in groups:
            profile = s.user.profile
            groups[s.user_id] = StoryGroup(
                user_id=s.user_id,
                username=s.user.username,
                avatar_url=profile.avatar_url if profile else "",
                stories=[],
                latest_at=s.created_at,
            )
        groups[s.user_id].stories.append(
            StoryItem(
                id=s.id,
                media_url=s.media_url,
                media_type=s.media_type,
                caption=s.caption,
                hashtag=s.hashtag or "",
                link_url=s.link_url or "",
                link_image=s.link_image or "",
                created_at=s.created_at,
                publish_at=s.publish_at,
            )
        )
        if s.created_at > groups[s.user_id].latest_at:
            groups[s.user_id].latest_at = s.created_at

    return sorted(groups.values(), key=lambda g: g.latest_at, reverse=True)


@router.delete("/{story_id}", status_code=204)
def delete_story(
    story_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    story = db.query(Story).filter(
        Story.id == story_id,
        Story.user_id == current_user.id,
    ).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story no encontrada")
    db.delete(story)
    db.commit()
