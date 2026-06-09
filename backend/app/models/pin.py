from sqlalchemy import Column, Integer, ForeignKey, DateTime, UniqueConstraint
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.db.database import Base

class PinPost(Base):
    __tablename__ = "pin_posts"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    post_id = Column(Integer, ForeignKey("posts.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    __table_args__ = (UniqueConstraint("user_id", "post_id", name="uq_pin_post"),)
    user = relationship("User", foreign_keys=[user_id])
    post = relationship("Post", foreign_keys=[post_id])
