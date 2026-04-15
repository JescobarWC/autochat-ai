"""Servicio de notificaciones por email cuando se captura un lead."""

import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import make_msgid, formatdate

import aiosmtplib
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


async def send_lead_notification(lead_data: dict, tenant_config: dict, tenant_name: str):
    """Envía email de notificación de nuevo lead a los destinatarios configurados."""
    notification = tenant_config.get("notification_email", {})
    if not notification or not notification.get("enabled"):
        return

    recipients = notification.get("to", [])
    if isinstance(recipients, str):
        recipients = [r.strip() for r in recipients.split(",") if r.strip()]
    if not recipients:
        return

    if not settings.smtp_host:
        logger.warning("SMTP no configurado, no se puede enviar notificación de lead")
        return

    name = lead_data.get("name", "Sin nombre")
    phone = lead_data.get("phone", "")
    email = lead_data.get("email", "")
    interest = lead_data.get("interest_type", "general")
    vehicle = lead_data.get("vehicle_brand_model", "") or lead_data.get("vehicle_interest_id", "")
    notes = lead_data.get("notes", "")
    postal = lead_data.get("postal_code", "")
    utm = lead_data.get("utm_data") or {}
    financing = "Sí" if lead_data.get("financing_needed") else "No"

    subject = f"Nuevo lead de AutoChat AI — {tenant_name} — {name}"

    html = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #2563eb; color: white; padding: 20px 24px; border-radius: 12px 12px 0 0;">
        <h2 style="margin: 0; font-size: 18px;">Nuevo lead capturado</h2>
        <p style="margin: 4px 0 0; opacity: 0.85; font-size: 14px;">{tenant_name} &mdash; AutoChat AI</p>
      </div>
      <div style="background: #f8fafc; padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr><td style="padding: 8px 0; color: #64748b; width: 140px;">Nombre</td><td style="padding: 8px 0; font-weight: 600;">{name}</td></tr>
          <tr><td style="padding: 8px 0; color: #64748b;">Teléfono</td><td style="padding: 8px 0; font-weight: 600;">{phone}</td></tr>
          <tr><td style="padding: 8px 0; color: #64748b;">Email</td><td style="padding: 8px 0;">{email or '—'}</td></tr>
          <tr><td style="padding: 8px 0; color: #64748b;">Código postal</td><td style="padding: 8px 0;">{postal or '—'}</td></tr>
          <tr><td style="padding: 8px 0; color: #64748b;">Interés</td><td style="padding: 8px 0;">{interest}</td></tr>
          <tr><td style="padding: 8px 0; color: #64748b;">Vehículo</td><td style="padding: 8px 0;">{vehicle or '—'}</td></tr>
          <tr><td style="padding: 8px 0; color: #64748b;">Financiación</td><td style="padding: 8px 0;">{financing}</td></tr>
          {f'<tr><td style="padding: 8px 0; color: #64748b;">Notas</td><td style="padding: 8px 0;">{notes}</td></tr>' if notes else ''}
          {f'<tr><td style="padding: 8px 0; color: #64748b;">Fuente</td><td style="padding: 8px 0;"><strong>{utm.get("utm_source", "")}</strong> / {utm.get("utm_medium", "")} / {utm.get("utm_campaign", "")}</td></tr>' if utm.get("utm_source") else ''}
          {f'<tr><td style="padding: 8px 0; color: #64748b;">Referrer</td><td style="padding: 8px 0; font-size: 12px;">{lead_data.get("referrer", "")}</td></tr>' if lead_data.get("referrer") else ''}
        </table>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 16px 0;">
        <p style="font-size: 12px; color: #94a3b8; margin: 0;">Este email ha sido generado automáticamente por AutoChat AI.</p>
      </div>
    </div>
    """

    msg = MIMEMultipart("alternative")
    msg["From"] = f"{settings.smtp_from_name} <{settings.smtp_from}>"
    msg["To"] = ", ".join(recipients)
    msg["Subject"] = subject
    msg["Message-ID"] = make_msgid(domain="eaistudio.es")
    msg["Date"] = formatdate(localtime=True)
    msg.attach(MIMEText(html, "html", "utf-8"))

    try:
        kwargs = {
            "hostname": settings.smtp_host,
            "port": settings.smtp_port,
        }
        # Solo usar auth y STARTTLS si hay credenciales configuradas
        if settings.smtp_user and settings.smtp_password:
            kwargs["username"] = settings.smtp_user
            kwargs["password"] = settings.smtp_password
            kwargs["start_tls"] = True
        else:
            kwargs["start_tls"] = False
        kwargs["use_tls"] = False

        await aiosmtplib.send(msg, **kwargs)
        logger.info(f"Email de lead enviado a {recipients} (tenant: {tenant_name})")
    except Exception as e:
        logger.error(f"Error enviando email de lead: {e}")
