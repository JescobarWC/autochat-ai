# AutoChat AI

Plataforma SaaS multi-tenant de chatbots con IA para concesionarios de coches de ocasión.

## Requisitos

- Docker + Docker Compose
- Una API key de OpenAI (GPT-4.1)

## Inicio rápido

```bash
cp .env.example .env
# Editar .env y poner tu OPENAI_API_KEY

docker-compose up --build
```

Abre http://localhost:8080 para ver la página de test con el widget de Worldcars.

## Endpoints principales

| Endpoint | Método | Descripción |
|---|---|---|
| `/health` | GET | Health check |
| `/v1/chat/init` | POST | Inicializar sesión (header X-Tenant-ID) |
| `/v1/chat` | POST | Enviar mensaje SSE streaming (header X-Tenant-ID) |
| `/v1/admin/auth/login` | POST | Login admin |
| `/v1/admin/tenants` | GET/POST | CRUD tenants |
| `/v1/admin/conversations` | GET | Listar conversaciones |
| `/v1/admin/leads` | GET | Listar leads |
| `/v1/admin/analytics/overview` | GET | Métricas |

## Credenciales de prueba

- **Admin**: admin@autochat.ai / admin123
- **Tenant Worldcars ID**: a1b2c3d4-e5f6-7890-abcd-ef1234567890

## Probar el chat

1. Abre http://localhost:8080
2. Haz clic en el botón azul de chat (esquina inferior derecha)
3. Prueba: "quiero un SUV automático por menos de 35.000€"
4. El bot buscará en el inventario y mostrará tarjetas de vehículos

## Documentación API

Con el backend corriendo: http://localhost:8000/docs
