from sqlalchemy.orm import Session
from app.models.notification import Notification

ICONS = {
    "comment":       "💬",
    "reply":         "↩️",
    "follow":        "👤",
    "repost":        "🔁",
    "reaction":      "❤️",
    "message":       "✉️",
    "mention":       "@",
    "debate_start":  "⚔️",
    "debate_result": "🏆",
    "welcome":       "🎉",
    "verify":        "📧",
    "milestone":     "🔥",
}


def push(
    db: Session,
    *,
    user_id: int,
    type: str,
    body: str,
    actor_id: int | None = None,
    entity_type: str | None = None,
    entity_id: int | None = None,
    link: str | None = None,
) -> None:
    if actor_id and user_id == actor_id:
        return
    icon = ICONS.get(type, "🔔")
    db.add(Notification(
        user_id=user_id,
        actor_id=actor_id,
        type=type,
        body=f"{icon} {body}",
        entity_type=entity_type,
        entity_id=entity_id,
        link=link,
    ))
