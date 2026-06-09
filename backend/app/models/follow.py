from sqlalchemy import Column, Integer, ForeignKey, DateTime, UniqueConstraint
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.db.database import Base

class Follow(Base):
    __tablename__ = "follows"
    id = Column(Integer, primary_key=True)
    follower_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    following_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    __table_args__ = (UniqueConstraint("follower_id", "following_id", name="uq_follow"),)
    follower = relationship("User", foreign_keys=[follower_id])
    following = relationship("User", foreign_keys=[following_id])
