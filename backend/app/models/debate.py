from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, UniqueConstraint
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.db.database import Base


class Debate(Base):
    __tablename__ = "debates"

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("posts.id"), unique=True, nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(String(20), default="active")  # active | closed
    closes_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    post = relationship("Post", foreign_keys=[post_id])
    creator = relationship("User", foreign_keys=[created_by])
    votes = relationship("DebateVote", back_populates="debate", cascade="all, delete-orphan")


class DebateVote(Base):
    __tablename__ = "debate_votes"

    id = Column(Integer, primary_key=True, index=True)
    debate_id = Column(Integer, ForeignKey("debates.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    side = Column(String(10), nullable=False)  # "for" | "against"
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    __table_args__ = (UniqueConstraint("debate_id", "user_id", name="uq_debate_vote"),)

    debate = relationship("Debate", back_populates="votes")
    user = relationship("User", foreign_keys=[user_id])
