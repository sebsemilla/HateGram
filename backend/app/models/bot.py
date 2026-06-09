from sqlalchemy import Column, Integer, String, Boolean, Float, JSON, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.db.database import Base


class Bot(Base):
    __tablename__ = "bots"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    template = Column(String(30), default="custom")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    active_until = Column(DateTime(timezone=True), nullable=True)  # None = sin expiración

    user = relationship("User")
    actions = relationship("BotAction", back_populates="bot", cascade="all, delete-orphan")


class BotAction(Base):
    __tablename__ = "bot_actions"

    id = Column(Integer, primary_key=True)
    bot_id = Column(Integer, ForeignKey("bots.id", ondelete="CASCADE"), nullable=False)
    # post | vote_truth | vote_fake | vote_for | vote_against | youtube_post
    action_type = Column(String(20), nullable=False)
    frequency_hours = Column(Float, default=6.0)
    content_pool = Column(JSON, default=list)       # frases para action_type="post"
    community_id = Column(Integer, ForeignKey("communities.id"), nullable=True)
    last_run = Column(DateTime(timezone=True), nullable=True)

    # YouTube + Gemini
    youtube_channel_id = Column(String(100), nullable=True)   # UCxxxxxx
    youtube_last_video_id = Column(String(50), nullable=True) # último video ya procesado
    gemini_prompt = Column(Text, nullable=True)               # instrucción para Gemini

    # Historial de ejecuciones (últimas 20 entradas ISO8601)
    run_log = Column(JSON, nullable=True, default=list)

    bot = relationship("Bot", back_populates="actions")
