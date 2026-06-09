"""
Sistema de mensajes directos.

Reglas:
- Cualquier usuario puede enviar el primer mensaje a otro (como Instagram).
- El receptor puede responder → activa la comunicación bilateral.
- El router devuelve la lista de conversaciones y los mensajes de cada hilo.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, func
from typing import Optional
from pydantic import BaseModel
from datetime import datetime, timezone

from app.db.database import get_db
from app.models.user import User
from app.models.message import Message
from app.models.post import Post
from app.core.deps import get_current_user

router = APIRouter(prefix="/messages", tags=["messages"])


def _user_out(user: User) -> dict:
    p = user.profile
    return {
        "id": user.id,
        "username": user.username,
        "display_name": p.display_name if p else user.username,
        "avatar_url": p.avatar_url if p else "",
    }


def _msg_out(msg: Message) -> dict:
    shared = None
    if msg.shared_post:
        post = msg.shared_post
        shared = {
            "id": post.id,
            "caption": post.caption or "",
            "image_url": post.image_url or "",
            "link_image": post.link_image or "",
            "link_title": post.link_title or "",
            "username": post.user.username if post.user else "",
        }
    return {
        "id": msg.id,
        "sender_id": msg.sender_id,
        "receiver_id": msg.receiver_id,
        "content": msg.content,
        "is_read": msg.is_read,
        "created_at": msg.created_at.isoformat(),
        "shared_post": shared,
    }


# ── Enviar mensaje ───────────────────────────────────────────────────────────

class MessageCreate(BaseModel):
    content: str
    shared_post_id: Optional[int] = None


@router.post("/{username}", status_code=201)
def send_message(
    username: str,
    data: MessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    target = db.query(User).filter(User.username == username).first()
    if not target:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if target.id == current_user.id:
        raise HTTPException(status_code=400, detail="No podés enviarte mensajes a vos mismo")
    if not data.content.strip():
        raise HTTPException(status_code=400, detail="El mensaje no puede estar vacío")

    # Verificar si el receptor ya respondió alguna vez → bilateral habilitada
    receiver_replied = db.query(Message).filter(
        Message.sender_id == target.id,
        Message.receiver_id == current_user.id,
    ).first()

    # Si nunca respondió, verificar que el sender no haya enviado más de 1 mensaje previo
    if not receiver_replied:
        prior = db.query(func.count(Message.id)).filter(
            Message.sender_id == current_user.id,
            Message.receiver_id == target.id,
        ).scalar()
        if prior >= 1:
            raise HTTPException(
                status_code=403,
                detail="Solo podés enviar un mensaje hasta que el usuario responda"
            )

    msg = Message(
        sender_id=current_user.id,
        receiver_id=target.id,
        content=data.content.strip(),
        shared_post_id=data.shared_post_id,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return _msg_out(msg)


# ── Hilo de mensajes con un usuario ─────────────────────────────────────────

@router.get("/{username}")
def get_thread(
    username: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    target = db.query(User).filter(User.username == username).first()
    if not target:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    messages = (
        db.query(Message)
        .filter(
            or_(
                and_(Message.sender_id == current_user.id, Message.receiver_id == target.id),
                and_(Message.sender_id == target.id, Message.receiver_id == current_user.id),
            )
        )
        .order_by(Message.created_at.asc())
        .all()
    )

    # Marcar como leídos los mensajes recibidos
    for m in messages:
        if m.receiver_id == current_user.id and not m.is_read:
            m.is_read = True
    db.commit()

    # Determinar si la comunicación es bilateral
    receiver_replied = any(m.sender_id == target.id for m in messages)

    return {
        "user": _user_out(target),
        "bilateral": receiver_replied,
        "messages": [_msg_out(m) for m in messages],
    }


# ── Lista de conversaciones ──────────────────────────────────────────────────

@router.get("/")
def list_conversations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Usuarios con quienes hay al menos un mensaje en cualquier dirección
    sent = db.query(Message.receiver_id).filter(Message.sender_id == current_user.id)
    received = db.query(Message.sender_id).filter(Message.receiver_id == current_user.id)
    peer_ids = {row[0] for row in sent.all()} | {row[0] for row in received.all()}

    conversations = []
    for peer_id in peer_ids:
        peer = db.query(User).filter(User.id == peer_id).first()
        if not peer:
            continue
        last_msg = (
            db.query(Message)
            .filter(
                or_(
                    and_(Message.sender_id == current_user.id, Message.receiver_id == peer_id),
                    and_(Message.sender_id == peer_id, Message.receiver_id == current_user.id),
                )
            )
            .order_by(Message.created_at.desc())
            .first()
        )
        unread = db.query(func.count(Message.id)).filter(
            Message.sender_id == peer_id,
            Message.receiver_id == current_user.id,
            Message.is_read == False,
        ).scalar()

        conversations.append({
            "user": _user_out(peer),
            "last_message": _msg_out(last_msg) if last_msg else None,
            "unread_count": unread,
        })

    # Ordenar por mensaje más reciente
    conversations.sort(key=lambda c: c["last_message"]["created_at"] if c["last_message"] else "", reverse=True)
    return conversations
