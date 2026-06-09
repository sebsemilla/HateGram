from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.db.database import Base


class Post(Base):
    __tablename__ = "posts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    caption = Column(Text, default="")
    image_url = Column(String(500), default="")

    community_id = Column(Integer, ForeignKey("communities.id"), nullable=True)

    # Link preview
    link_url = Column(String(500), default="")
    link_title = Column(String(300), default="")
    link_description = Column(Text, default="")
    link_image = Column(String(500), default="")

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Repost
    repost_of_id = Column(Integer, ForeignKey("posts.id"), nullable=True)

    user = relationship("User", backref="posts")
    community = relationship("Community", foreign_keys=[community_id])
    repost_of = relationship("Post", foreign_keys=[repost_of_id], remote_side="Post.id")
