from sqlalchemy import Column, Integer, Text, ForeignKey, DateTime, Boolean, String
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.db.database import Base


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    receiver_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content = Column(Text, nullable=False)
    # Si es un post compartido
    shared_post_id = Column(Integer, ForeignKey("posts.id"), nullable=True)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    sender = relationship("User", foreign_keys=[sender_id])
    receiver = relationship("User", foreign_keys=[receiver_id])
    shared_post = relationship("Post", foreign_keys=[shared_post_id])
