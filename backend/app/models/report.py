from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.db.database import Base


class Report(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, index=True)
    reporter_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    reported_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    reported_post_id = Column(Integer, ForeignKey("posts.id"), nullable=True)
    reason = Column(String(100), nullable=False)
    description = Column(Text, default="")
    status = Column(String(20), default="pending")  # pending, resolved, dismissed
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    resolved_at = Column(DateTime(timezone=True), nullable=True)

    reporter = relationship("User", foreign_keys=[reporter_id])
    reported_user = relationship("User", foreign_keys=[reported_user_id])
    reported_post = relationship("Post", foreign_keys=[reported_post_id])
