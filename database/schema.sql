-- ============================================================================
--  eGuardian AI Concierge — Esquema relacional (PostgreSQL 16)
--  MVP. Multi-condominio (multi-tenant por columna), soft-deletes, auditoría.
--  Convención: snake_case, claves UUID, timestamps en UTC.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "citext";     -- emails case-insensitive

-- ---------------------------------------------------------------------------
-- Tenancy
-- ---------------------------------------------------------------------------
CREATE TABLE condominiums (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          VARCHAR(160) NOT NULL,
    address       VARCHAR(255),
    timezone      VARCHAR(64)  NOT NULL DEFAULT 'America/Santiago',
    settings      JSONB        NOT NULL DEFAULT '{}',
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    deleted_at    TIMESTAMPTZ
);

-- ---------------------------------------------------------------------------
-- Auth / RBAC
-- ---------------------------------------------------------------------------
CREATE TABLE roles (
    id          SMALLSERIAL PRIMARY KEY,
    slug        VARCHAR(40) UNIQUE NOT NULL,   -- super_admin | admin | operator | viewer
    name        VARCHAR(80) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE permissions (
    id          SMALLSERIAL PRIMARY KEY,
    slug        VARCHAR(60) UNIQUE NOT NULL,   -- residents.manage | visits.read ...
    name        VARCHAR(120) NOT NULL
);

CREATE TABLE role_permission (
    role_id        SMALLINT REFERENCES roles(id) ON DELETE CASCADE,
    permission_id  SMALLINT REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    condominium_id  UUID REFERENCES condominiums(id) ON DELETE CASCADE,
    role_id         SMALLINT NOT NULL REFERENCES roles(id),
    name            VARCHAR(160) NOT NULL,
    email           CITEXT UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    phone           VARCHAR(30),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ
);
CREATE INDEX idx_users_condo ON users(condominium_id) WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Residentes y unidades
-- ---------------------------------------------------------------------------
CREATE TABLE apartments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    condominium_id  UUID NOT NULL REFERENCES condominiums(id) ON DELETE CASCADE,
    code            VARCHAR(20) NOT NULL,        -- "302", "1204"
    tower           VARCHAR(20),
    floor           SMALLINT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ,
    UNIQUE (condominium_id, code)
);

CREATE TABLE residents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    condominium_id  UUID NOT NULL REFERENCES condominiums(id) ON DELETE CASCADE,
    apartment_id    UUID REFERENCES apartments(id) ON DELETE SET NULL,
    full_name       VARCHAR(160) NOT NULL,
    email           CITEXT,
    phone           VARCHAR(30),
    notify_channel  VARCHAR(20) NOT NULL DEFAULT 'push',  -- push|sms|whatsapp|call
    auto_approve    BOOLEAN NOT NULL DEFAULT FALSE,
    status          VARCHAR(20) NOT NULL DEFAULT 'active', -- active|suspended
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ
);
CREATE INDEX idx_residents_condo ON residents(condominium_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_residents_apt   ON residents(apartment_id);

-- Autorizaciones permanentes (lista blanca de visitantes recurrentes)
CREATE TABLE resident_authorizations (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resident_id   UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
    visitor_name  VARCHAR(160) NOT NULL,
    document_id   VARCHAR(40),
    valid_until   DATE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Visitantes y visitas
-- ---------------------------------------------------------------------------
CREATE TABLE visitors (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    condominium_id  UUID NOT NULL REFERENCES condominiums(id) ON DELETE CASCADE,
    full_name       VARCHAR(160),
    document_id     VARCHAR(40),
    phone           VARCHAR(30),
    company         VARCHAR(120),                -- empresa de delivery, etc.
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ
);

CREATE TYPE visit_type   AS ENUM ('visit','delivery','service','emergency');
CREATE TYPE visit_status AS ENUM
    ('pending','notified','approved','rejected','scheduled','escalated','completed','expired');

CREATE TABLE visits (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    condominium_id  UUID NOT NULL REFERENCES condominiums(id) ON DELETE CASCADE,
    visitor_id      UUID REFERENCES visitors(id) ON DELETE SET NULL,
    resident_id     UUID REFERENCES residents(id) ON DELETE SET NULL,
    apartment_id    UUID REFERENCES apartments(id) ON DELETE SET NULL,
    device_id       UUID,                        -- FK añadida más abajo
    type            visit_type   NOT NULL DEFAULT 'visit',
    status          visit_status NOT NULL DEFAULT 'pending',
    qr_token        VARCHAR(64) UNIQUE,          -- QR temporal
    qr_expires_at   TIMESTAMPTZ,
    scheduled_for   TIMESTAMPTZ,
    resolved_at     TIMESTAMPTZ,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ
);
CREATE INDEX idx_visits_condo_date ON visits(condominium_id, created_at);
CREATE INDEX idx_visits_status     ON visits(status) WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Dispositivos (tótems)
-- ---------------------------------------------------------------------------
CREATE TABLE devices (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    condominium_id  UUID NOT NULL REFERENCES condominiums(id) ON DELETE CASCADE,
    name            VARCHAR(80) NOT NULL,        -- "Tótem Lobby"
    serial          VARCHAR(80) UNIQUE,
    location        VARCHAR(120),
    status          VARCHAR(20) NOT NULL DEFAULT 'offline', -- online|offline|maintenance
    last_seen_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ
);
ALTER TABLE visits
    ADD CONSTRAINT fk_visits_device
    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- Operadores (teleasistencia)
-- ---------------------------------------------------------------------------
CREATE TABLE operators (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    condominium_id  UUID REFERENCES condominiums(id) ON DELETE SET NULL, -- NULL = pool global
    status          VARCHAR(20) NOT NULL DEFAULT 'offline', -- available|busy|paused|offline
    shift_start     TIME,
    shift_end       TIME,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Conversaciones
-- ---------------------------------------------------------------------------
CREATE TYPE convo_status AS ENUM ('active','closed_ai','escalated','with_operator','closed_op');

CREATE TABLE conversations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    condominium_id  UUID NOT NULL REFERENCES condominiums(id) ON DELETE CASCADE,
    device_id       UUID REFERENCES devices(id) ON DELETE SET NULL,
    visit_id        UUID REFERENCES visits(id) ON DELETE SET NULL,
    operator_id     UUID REFERENCES operators(id) ON DELETE SET NULL,
    detected_intent VARCHAR(40),
    status          convo_status NOT NULL DEFAULT 'active',
    started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at        TIMESTAMPTZ,
    summary         TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ
);
CREATE INDEX idx_convo_condo ON conversations(condominium_id, started_at);

CREATE TYPE msg_sender AS ENUM ('visitor','ai','operator','system');

CREATE TABLE conversation_messages (
    id               BIGSERIAL PRIMARY KEY,
    conversation_id  UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender           msg_sender NOT NULL,
    content          TEXT NOT NULL,
    audio_url        VARCHAR(255),               -- objeto en almacenamiento (Whisper/TTS)
    intent           VARCHAR(40),
    confidence       NUMERIC(4,3),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_msg_convo ON conversation_messages(conversation_id, created_at);

-- ---------------------------------------------------------------------------
-- Incidentes (escalamientos / emergencias)
-- ---------------------------------------------------------------------------
CREATE TYPE incident_priority AS ENUM ('low','normal','high','critical');
CREATE TYPE incident_status   AS ENUM ('open','assigned','in_progress','resolved','cancelled');

CREATE TABLE incidents (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    condominium_id   UUID NOT NULL REFERENCES condominiums(id) ON DELETE CASCADE,
    conversation_id  UUID REFERENCES conversations(id) ON DELETE SET NULL,
    operator_id      UUID REFERENCES operators(id) ON DELETE SET NULL,
    reason           VARCHAR(255) NOT NULL,
    priority         incident_priority NOT NULL DEFAULT 'normal',
    status           incident_status   NOT NULL DEFAULT 'open',
    opened_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at      TIMESTAMPTZ,
    resolution_note  TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at       TIMESTAMPTZ
);
CREATE INDEX idx_incidents_status ON incidents(status) WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- Auditoría / logs (append-only)
-- ---------------------------------------------------------------------------
CREATE TABLE logs (
    id              BIGSERIAL PRIMARY KEY,
    condominium_id  UUID,
    actor_type      VARCHAR(20),                 -- user|operator|device|system
    actor_id        UUID,
    action          VARCHAR(80) NOT NULL,        -- visit.approved, auth.login...
    entity_type     VARCHAR(40),
    entity_id       UUID,
    metadata        JSONB NOT NULL DEFAULT '{}',
    ip_address      INET,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_logs_condo_date ON logs(condominium_id, created_at);
CREATE INDEX idx_logs_entity     ON logs(entity_type, entity_id);

-- ============================================================================
--  Vista de apoyo para el dashboard
-- ============================================================================
CREATE VIEW v_daily_visit_stats AS
SELECT condominium_id,
       date_trunc('day', created_at) AS day,
       type,
       status,
       count(*) AS total
FROM visits
WHERE deleted_at IS NULL
GROUP BY 1,2,3,4;
