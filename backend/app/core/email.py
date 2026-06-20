import resend
from app.core.config import settings

resend.api_key = settings.RESEND_API_KEY

FROM_ADDRESS = "HateGram <onboarding@resend.dev>"


def send_verification_email(to_email: str, username: str, token: str) -> bool:
    verify_url = f"{settings.FRONTEND_URL}/verify-email?token={token}"
    try:
        resend.Emails.send({
            "from": FROM_ADDRESS,
            "to": [to_email],
            "subject": "Verificá tu cuenta en HateGram",
            "html": f"""
            <div style="font-family:sans-serif;max-width:480px;margin:auto;background:#111;color:#fff;padding:32px;border-radius:12px;">
              <h1 style="color:#E63946;margin-bottom:4px;">HateGram</h1>
              <p style="color:#aaa;margin-top:0;">La red social sin filtros</p>
              <hr style="border-color:#333;margin:24px 0;">
              <p>Hola <strong>{username}</strong>,</p>
              <p>Hacé clic en el botón para verificar tu cuenta:</p>
              <a href="{verify_url}"
                 style="display:inline-block;background:#E63946;color:#fff;font-weight:700;
                        padding:12px 28px;border-radius:8px;text-decoration:none;margin:16px 0;">
                Verificar cuenta
              </a>
              <p style="color:#666;font-size:12px;margin-top:24px;">
                Este link expira en 24 horas. Si no creaste una cuenta, ignorá este email.
              </p>
            </div>
            """,
        })
        return True
    except Exception as e:
        print(f"[email] Error enviando verificación: {e}")
        return False


def send_reset_email(to_email: str, username: str, token: str) -> bool:
    reset_url = f"{settings.FRONTEND_URL}/reset-password?token={token}"
    try:
        resend.Emails.send({
            "from": FROM_ADDRESS,
            "to": [to_email],
            "subject": "Resetear contraseña — HateGram",
            "html": f"""
            <div style="font-family:sans-serif;max-width:480px;margin:auto;background:#111;color:#fff;padding:32px;border-radius:12px;">
              <h1 style="color:#E63946;margin-bottom:4px;">HateGram</h1>
              <p style="color:#aaa;margin-top:0;">La red social sin filtros</p>
              <hr style="border-color:#333;margin:24px 0;">
              <p>Hola <strong>{username}</strong>,</p>
              <p>Recibimos una solicitud para resetear tu contraseña:</p>
              <a href="{reset_url}"
                 style="display:inline-block;background:#E63946;color:#fff;font-weight:700;
                        padding:12px 28px;border-radius:8px;text-decoration:none;margin:16px 0;">
                Resetear contraseña
              </a>
              <p style="color:#666;font-size:12px;margin-top:24px;">
                Este link expira en 30 minutos. Si no solicitaste esto, ignorá este email.
              </p>
            </div>
            """,
        })
        return True
    except Exception as e:
        print(f"[email] Error enviando reset: {e}")
        return False
