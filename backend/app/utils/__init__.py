"""Utilidades de seguridad."""
import ipaddress
import socket
from urllib.parse import urlparse


def validate_webhook_url(url: str) -> str:
    """Valida que una URL de webhook sea segura (no SSRF)."""
    if not url:
        raise ValueError("URL vacía")
    parsed = urlparse(url)
    if parsed.scheme not in ("https",):
        raise ValueError("Solo se permiten URLs HTTPS")
    hostname = parsed.hostname
    if not hostname:
        raise ValueError("Hostname inválido")
    try:
        ip = ipaddress.ip_address(socket.gethostbyname(hostname))
    except (socket.gaierror, ValueError):
        raise ValueError(f"No se puede resolver el hostname: {hostname}")
    if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved:
        raise ValueError("No se permiten IPs privadas o reservadas")
    return url
