-- ============================================================
-- AutoChat AI — Schema inicial + Seed data
-- ============================================================

-- Extensión UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TABLAS
-- ============================================================

CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    allowed_domains TEXT[] DEFAULT '{}',
    config JSONB DEFAULT '{}',
    inventory_api_config JSONB DEFAULT '{}',
    billing_plan VARCHAR(50) DEFAULT 'trial',
    billing_status VARCHAR(50) DEFAULT 'active',
    monthly_message_limit INTEGER DEFAULT 1000,
    messages_used INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'admin',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    session_id VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    page_context JSONB DEFAULT '{}',
    messages_count INTEGER DEFAULT 0,
    lead_captured BOOLEAN DEFAULT FALSE,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    last_message_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_conversations_tenant ON conversations(tenant_id);
CREATE INDEX idx_conversations_session ON conversations(session_id);

CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES conversations(id),
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    email VARCHAR(255),
    vehicle_interest_id VARCHAR(100),
    interest_type VARCHAR(50) DEFAULT 'general',
    notes TEXT,
    status VARCHAR(50) DEFAULT 'new',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_leads_tenant ON leads(tenant_id);

CREATE TABLE IF NOT EXISTS usage_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    total_conversations INTEGER DEFAULT 0,
    total_messages INTEGER DEFAULT 0,
    total_leads INTEGER DEFAULT 0,
    tokens_input INTEGER DEFAULT 0,
    tokens_output INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, date)
);

CREATE INDEX idx_usage_tenant_date ON usage_metrics(tenant_id, date);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_conversations ON conversations
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

CREATE POLICY tenant_isolation_leads ON leads
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

CREATE POLICY tenant_isolation_usage ON usage_metrics
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- ============================================================
-- SEED DATA — Worldcars (primer cliente)
-- ============================================================

INSERT INTO tenants (id, slug, name, is_active, allowed_domains, config, inventory_api_config, billing_plan, monthly_message_limit)
VALUES (
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    'worldcars',
    'Worldcars',
    TRUE,
    ARRAY['localhost', '127.0.0.1', 'worldcars.es', 'www.worldcars.es'],
    '{
        "bot_name": "Asistente Worldcars",
        "company_info": {
            "name": "Worldcars",
            "address": "Madrid, España",
            "phone": "+34 91 000 00 00",
            "schedule": "Lunes a Viernes 9:00 - 20:00, Sábados 10:00 - 14:00",
            "website": "https://worldcars.es"
        },
        "widget_theme": {
            "primary_color": "#1E40AF",
            "accent_color": "#10B981",
            "position": "bottom-right",
            "welcome_message": "¡Hola! 👋 Soy el asistente de Worldcars. ¿En qué puedo ayudarte? Puedo buscar coches, darte información sobre financiación o resolver cualquier duda.",
            "show_powered_by": true
        },
        "url_patterns": {
            "vehicle_detail": "/comprar-coches-ocasion/:brand/:model/:id",
            "listing": "/comprar-coches-ocasion",
            "financing": "/financiacion",
            "contact": "/contacto"
        },
        "overrides": {
            "warranty_policy": "Todos nuestros vehículos incluyen 1 año de garantía mecánica.",
            "delivery_info": "Entrega a domicilio disponible en toda la Comunidad de Madrid sin coste adicional.",
            "personality": "Cercano, profesional y con conocimiento del mercado de coches de ocasión en España."
        }
    }'::jsonb,
    '{"type": "mock"}'::jsonb,
    'professional',
    5000
) ON CONFLICT (slug) DO NOTHING;

-- Admin user: admin@autochat.ai / admin123
-- Hash bcrypt de "admin123"
INSERT INTO admin_users (email, password_hash, full_name, role)
VALUES (
    'admin@autochat.ai',
    '$2b$12$3MCd7DDd0Fj.7jH4h6Q5f.63p8Z85ACLlal38lWqAiTkhSv3kVvfW',
    'Admin AutoChat',
    'superadmin'
) ON CONFLICT (email) DO NOTHING;
