from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime, timezone, timedelta
from app.db.database import Base


class Story(Base):
    __tablename__ = "stories"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    media_url = Column(String(500), nullable=False)
    media_type = Column(String(10), default="image")  # "image" | "video"
    caption = Column(Text, default="")
    hashtag   = Column(String(100), default="")
    link_url  = Column(String(500), default="")
    link_image = Column(String(500), default="")

    publish_at = Column(DateTime(timezone=True), nullable=True)   # None = publicar ya
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    expires_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc) + timedelta(hours=12),
    )

    user = relationship("User", backref="stories")
