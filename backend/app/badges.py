"""
Lógica de badges/stats de usuario. Computados on-the-fly a partir de actividad real.
"""
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.post import Post
from app.models.fact_vote import FactVote
from app.models.debate import DebateVote

BADGE_DEFS = {
    "truther": {
        "name": "Truther",
        "description": "Publica con fuentes verificadas que la comunidad reconoce como verdad",
        "icon": "🔍",
        "color": "#22c55e",   # green
        "threshold": 3,       # posts con link + truth_pct >= 70%
    },
    "ethic_force": {
        "name": "Ethic Force",
        "description": "Verificador activo: vota el contenido ajeno y participa en debates",
        "icon": "🛡️",
        "color": "#3b82f6",   # blue
        "threshold": 5,       # votos truth emitidos + votos en debates
    },
}


def _truther_score(user_id: int, db: Session) -> int:
    """
    Posts propios con link_url donde truth_pct >= 70% (mínimo 3 votos).
    Cada post así suma 1 punto.
    """
    posts = (
        db.query(Post)
        .filter(Post.user_id == user_id, Post.link_url != "", Post.link_url.isnot(None))
        .all()
    )
    score = 0
    for post in posts:
        total = (
            db.query(func.count(FactVote.id))
            .filter(FactVote.post_id == post.id)
            .scalar() or 0
        )
        if total < 3:
            continue
        truth = (
            db.query(func.count(FactVote.id))
            .filter(FactVote.post_id == post.id, FactVote.vote == "truth")
            .scalar() or 0
        )
        if (truth / total) >= 0.70:
            score += 1
    return score


def _ethic_force_score(user_id: int, db: Session) -> int:
    """
    Votos truth emitidos sobre posts ajenos + votos en debates.
    """
    truth_votes = (
        db.query(func.count(FactVote.id))
        .filter(FactVote.user_id == user_id, FactVote.vote == "truth")
        .scalar() or 0
    )
    debate_votes = (
        db.query(func.count(DebateVote.id))
        .filter(DebateVote.user_id == user_id)
        .scalar() or 0
    )
    return truth_votes + debate_votes


def get_user_badges(user_id: int, db: Session) -> list[dict]:
    """Devuelve la lista de badges ganados por el usuario."""
    badges = []

    ts = _truther_score(user_id, db)
    if ts >= BADGE_DEFS["truther"]["threshold"]:
        d = BADGE_DEFS["truther"]
        badges.append({
            "slug": "truther",
            "name": d["name"],
            "description": d["description"],
            "icon": d["icon"],
            "color": d["color"],
            "score": ts,
        })

    es = _ethic_force_score(user_id, db)
    if es >= BADGE_DEFS["ethic_force"]["threshold"]:
        d = BADGE_DEFS["ethic_force"]
        badges.append({
            "slug": "ethic_force",
            "name": d["name"],
            "description": d["description"],
            "icon": d["icon"],
            "color": d["color"],
            "score": es,
        })

    return badges
