from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.db.database import Base


class Profile(Base):
    __tablename__ = "profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    display_name = Column(String(60), nullable=False)
    bio = Column(Text, default="")
    avatar_url = Column(String(500), default="")
    banner_url = Column(String(500), default="")
    website = Column(String(255), default="")
    location = Column(String(100), default="")
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="profile")
