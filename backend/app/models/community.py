from sqlalchemy import Column, Integer, String, Text, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.db.database import Base


class Community(Base):
    __tablename__ = "communities"

    id = Column(Integer, primary_key=True, index=True)
    slug = Column(String(60), unique=True, index=True, nullable=False)
    name = Column(String(100), nullable=False)
    description = Column(Text, default="")
    image_url = Column(String(500), default="")
    type = Column(String(20), nullable=False)  # "orientation" | "fan"
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    creator = relationship("User", foreign_keys=[created_by])
    memberships = relationship("Membership", back_populates="community", cascade="all, delete-orphan")


class Membership(Base):
    __tablename__ = "memberships"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    community_id = Column(Integer, ForeignKey("communities.id"), nullable=False)
    joined_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    user = relationship("User", foreign_keys=[user_id])
    community = relationship("Community", back_populates="memberships")
