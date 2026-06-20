from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from app.db.database import Base

VALID_INTERESTS = [
    "politica",
    "deportes",
    "tecnologia",
    "humor",
    "arte",
    "ciencia",
    "lifestyle",
    "entretenimiento",
]


class UserInterest(Base):
    __tablename__ = "user_interests"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    interest = Column(String(30), nullable=False)

    user = relationship("User", back_populates="interests")
