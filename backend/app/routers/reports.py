from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from app.db.database import get_db
from app.models.report import Report
from app.models.user import User
from app.core.deps import get_current_user

router = APIRouter(prefix="/reports", tags=["reports"])

VALID_REASONS = [
    "spam", "acoso", "contenido_inapropiado", "discurso_de_odio",
    "desinformacion", "violencia", "otro",
]


class ReportCreate(BaseModel):
    reason: str
    description: Optional[str] = ""
    reported_user_id: Optional[int] = None
    reported_post_id: Optional[int] = None


@router.post("/", status_code=201)
def create_report(
    data: ReportCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if data.reason not in VALID_REASONS:
        raise HTTPException(status_code=400, detail="Razón de reporte inválida")
    if not data.reported_user_id and not data.reported_post_id:
        raise HTTPException(status_code=400, detail="Debés indicar un usuario o post a reportar")
    if data.reported_user_id == current_user.id:
        raise HTTPException(status_code=400, detail="No podés reportarte a vos mismo")

    report = Report(
        reporter_id=current_user.id,
        reported_user_id=data.reported_user_id,
        reported_post_id=data.reported_post_id,
        reason=data.reason,
        description=data.description,
    )
    db.add(report)
    db.commit()
    return {"message": "Reporte enviado"}
