from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, UniqueConstraint
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.db.database import Base


class FactVote(Base):
    __tablename__ = "fact_votes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    post_id = Column(Integer, ForeignKey("posts.id"), nullable=False)
    vote = Column(String(10), nullable=False)  # "facts" | "cap"
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    __table_args__ = (UniqueConstraint("user_id", "post_id", name="uq_fact_vote"),)

    user = relationship("User", foreign_keys=[user_id])
    post = relationship("Post", foreign_keys=[post_id])
