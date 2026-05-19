# eGuardian AI Concierge — Documentación Técnica del MVP

> Conserje virtual inteligente para Smart Buildings: tótem con avatar IA que
> atiende visitas, valida accesos, entrega información y escala a operadores
> humanos de un centro de monitoreo remoto.

**Versión:** MVP 1.0 · **Stack:** Next.js · Laravel 12 · PostgreSQL 16 · OpenAI
· **Despliegue:** Docker · NGINX · Ubuntu Server

---

## 1. Alcance del MVP

El MVP es **arquitectónicamente completo y demostrable**. Lo que esta entrega
incluye, listo para una demo comercial:

| Entregable | Estado en esta entrega |
|---|---|
| Arquitectura cloud-ready y modular | Definida (este documento) |
| Tótem virtual interactivo (avatar IA, voz/texto, flujos) | **Prototipo funcional** (`frontend/Totem.jsx`) |
| Panel administrativo (5 módulos) | **Prototipo funcional** (`frontend/AdminPanel.jsx`) |
| Motor conversacional (intención, contexto, escalamiento) | Implementado (servicio Laravel + simulador en el tótem) |
| Modelo relacional + scripts SQL | Completo (`database/`) |
| Backend Laravel (servicios, controladores, modelos, rutas, eventos) | Scaffolding representativo (`backend/`) |
| Docker / NGINX / variables de entorno | Completo (`docker-compose.yml`, `infra/`, `.env.example`) |
| Roadmap técnico | Sección 9 |

Lo que **queda como trabajo de sprints posteriores**: implementar el resto de
controladores CRUD a partir del patrón entregado, conectar las claves reales de
OpenAI, las pasarelas de notificación (push/SMS/WhatsApp) y endurecer el
despliegue productivo. El esqueleto entregado define el patrón a replicar.

---

## 2. Arquitectura general

Sistema de **3 planos** desacoplados sobre un único origen tras NGINX:

```
                          ┌────────────────────────────┐
   Tótem (1080x1920)  ───▶ │                            │
   navegador/kiosk         │         NGINX              │
                           │   reverse-proxy + TLS      │
   Panel Web / Operador ──▶ │                            │
                          └──────┬───────────┬──────────┘
                                 │           │
                    ┌────────────▼──┐   ┌────▼─────────────┐
                    │ Next.js (web) │   │  Laravel 12 API   │
                    │  tótem + panel│   │  REST /api/v1     │
                    └───────────────┘   └──┬────────┬───────┘
                                           │        │
                          ┌────────────────▼──┐  ┌──▼──────────────┐
                          │ PostgreSQL 16      │  │ Reverb (WS)     │
                          │ datos + auditoría  │  │ tiempo real     │
                          └────────────────────┘  └─────────────────┘
                                           │
                          ┌────────────────▼───────────────────────┐
                          │ OpenAI: Chat (intención+NLG) · Whisper  │
                          │ (STT) · TTS (voz) — vía AiConciergeSvc  │
                          └─────────────────────────────────────────┘
```

**Principios de diseño**

- **API-first**: el frontend nunca habla con OpenAI ni con la base directamente.
  Toda lógica de negocio, costos de IA y datos personales pasan por la API.
- **Multi-condominio desde el día 1**: `condominium_id` en cada tabla de
  negocio; el tenant se resuelve por el claim del JWT.
- **Tiempo real desacoplado**: los escalamientos y resoluciones de visita se
  propagan por WebSockets (Laravel Reverb), sin polling.
- **Append-only audit**: tabla `logs` inmutable para trazabilidad y
  cumplimiento de la Ley N° 19.628.

---

## 3. Estructura de carpetas

```
eguardian/
├── docker-compose.yml          # orquestación completa
├── .env.example                # variables de entorno (todas)
├── infra/
│   └── nginx.conf              # reverse-proxy API+web+WS
├── database/
│   ├── schema.sql              # DDL PostgreSQL completo
│   └── seed.sql                # datos demo
├── backend/                    # Laravel 12 / PHP 8.4
│   ├── Dockerfile
│   ├── app/
│   │   ├── Services/AiConciergeService.php      # OpenAI/Whisper/TTS + intención
│   │   ├── Http/Controllers/Api/
│   │   │   ├── ConversationController.php        # turno del tótem
│   │   │   └── VisitController.php               # visitas + resolución
│   │   ├── Models/CoreModels.php                 # Conversation/Resident/Visit…
│   │   └── Events/OperatorEscalation.php         # broadcast WS
│   ├── database/migrations/                      # patrón de migración
│   └── routes/api.php                            # superficie REST v1
└── frontend/                   # Next.js / React / TypeScript / Tailwind
    ├── Dockerfile
    ├── Totem.jsx               # TÓTEM interactivo (demo)
    └── AdminPanel.jsx          # PANEL administrativo (demo)
```

> En producción `Models/CoreModels.php` se divide en un archivo por modelo y
> los componentes `.jsx` se integran como páginas Next.js
> (`app/totem/page.tsx`, `app/(admin)/...`).

---

## 4. Motor conversacional

El cerebro vive en `AiConciergeService` (backend). Cada turno:

1. **STT** — si llega audio, Whisper lo transcribe a español.
2. **Razonamiento** — Chat Completions con `response_format: json_object` y un
   *system prompt* que fija el rol, el tono (cordial, profesional, breve) y el
   contrato de salida.
3. **Salida estructurada** — el modelo devuelve siempre:
   `{ reply, intent, confidence, action }`.
4. **Acción** — el backend ejecuta `action`: `notify_resident` (resuelve al
   residente por depto/nombre, crea la visita, dispara notificación) o
   `escalate` (abre incidente y emite evento WS al centro de monitoreo).
5. **TTS** — la respuesta se sintetiza a MP3 y el tótem la reproduce mientras
   anima el avatar.

**Intenciones reconocidas:** `visit`, `delivery`, `emergency`, `support`,
`info`, `greeting`, `unknown`.

| Frase del visitante | Intención | Acción |
|---|---|---|
| "Vengo al depto 302" | visit | notify_resident |
| "Busco a Juan Pérez" | visit | notify_resident |
| "Tengo una entrega" | delivery | pedir depto → registrar |
| "Necesito ayuda / incendio" | emergency | escalate (critical) |
| "Quiero hablar con conserjería" | support | escalate (normal) |
| "¿Horario de la piscina?" | info | responder con datos del condominio |

El prototipo `Totem.jsx` implementa un **clasificador determinista equivalente**
para que la demo funcione sin clave de OpenAI; la lógica de flujo (lookup →
notificación → aprobación/rechazo → escalamiento) es idéntica a la del backend.

---

## 5. Flujos operacionales

**5.1 Visita normal**
`detectar → saludar → preguntar residente → resolver residente → crear visita
(notified) → notificar residente → residente aprueba/rechaza (app, vía
PATCH /visits/{id}/resolve) → broadcast WS → tótem informa al visitante.`
Si el residente tiene `auto_approve`, se omite la espera.

**5.2 Delivery**
`detectar delivery → solicitar depto → registrar visita tipo delivery + folio →
notificar residente → indicar casillero/instrucción.`

**5.3 Escalamiento**
Disparadores: IA no entiende tras reintentos, el usuario solicita un humano, o
se detecta emergencia. Efecto: se crea `Incident`, la conversación pasa a
`escalated`, se emite `OperatorEscalation` por el canal privado
`condo.{id}.operators`; el panel lo muestra en la cola y el operador "toma" el
caso (chat en vivo; videollamada en roadmap).

---

## 6. Modelo relacional (resumen)

13 tablas núcleo (DDL completo en `database/schema.sql`):

`condominiums` · `roles` · `permissions` · `role_permission` · `users` ·
`apartments` · `residents` · `resident_authorizations` · `visitors` · `visits`
· `devices` · `operators` · `conversations` · `conversation_messages` ·
`incidents` · `logs`.

Características transversales: claves **UUID**, **soft-deletes** (`deleted_at`),
**timestamps** UTC, `condominium_id` para **multi-tenant**, tipos `ENUM` para
estados, índices por tenant+fecha y vista `v_daily_visit_stats` para el
dashboard. Tabla `logs` append-only para auditoría.

---

## 7. API REST (v1)

Superficie versionada en `routes/api.php`. Autenticación **JWT**; los tótems
usan un *guard* de dispositivo separado con rate-limit más alto.

| Método | Ruta | Uso |
|---|---|---|
| POST | `/api/v1/auth/login` | login panel/operador |
| POST | `/api/v1/conversations` | tótem abre sesión |
| POST | `/api/v1/conversations/{id}/turn` | turno (texto o audio) |
| GET | `/api/v1/dashboard` | métricas |
| `apiResource` | `/api/v1/residents` | CRUD residentes |
| GET/POST | `/api/v1/visits` | listado / programar (QR) |
| PATCH | `/api/v1/visits/{id}/resolve` | residente aprueba/rechaza |
| GET | `/api/v1/conversations` | transcripciones |
| POST | `/api/v1/incidents/{id}/take` | operador toma caso |
| GET | `/api/v1/visits/qr/{token}` | QR temporal (público) |

Throttling por capa (`10,1` login · `120,1` tótem · `60,1` panel) y
autorización por permiso (`can:residents.manage`, etc.).

---

## 8. Seguridad y cumplimiento

- **JWT** con TTL corto + refresh; **RBAC** por rol/permiso.
- **Rate limiting** diferenciado por superficie; CORS restringido al panel.
- **Cifrado** TLS en tránsito; secretos vía variables de entorno (nunca en
  repositorio).
- **Auditoría** append-only (`logs`) de acciones sensibles (login, aprobación,
  escalamiento).
- **Ley N° 19.628 (Chile)**: aviso visible en el tótem sobre captación de
  audio/video; minimización de datos; `DATA_RETENTION_DAYS` para purga
  automática de audio y transcripciones; soft-delete + derecho a supresión;
  datos de terceros nunca se revelan al visitante.

---

## 9. Roadmap técnico

Arquitectura ya preparada para conectar, sin re-diseño:

- **Accesos físicos**: integración Hikvision / ControlApp, ANPR (patentes),
  control de ascensores, QR dinámicos — la tabla `devices` y el patrón de
  `action` lo soportan.
- **Reconocimiento facial**: pipeline de visión asociado a `visitors`.
- **Voz en tiempo real**: WebRTC + Realtime API sobre el canal WS existente.
- **Canales**: WhatsApp Business / SIP para notificación al residente
  (`residents.notify_channel` ya contempla el enum).
- **App móvil residentes**: el endpoint `/visits/{id}/resolve` ya es el contrato.
- **IA predictiva**: analítica sobre `logs` y `v_daily_visit_stats`.

---

## 10. Cómo ejecutar la demo

**Prototipos visuales (sin backend):** abrir `frontend/Totem.jsx` y
`frontend/AdminPanel.jsx` como artefactos React — funcionan de inmediato. En el
tótem, la voz usa la Web Speech API del navegador (Chrome recomendado); si no
está disponible, hay *fallback* a teclado y botones rápidos.

**Stack completo (local):**

```bash
cp .env.example .env          # completar OPENAI_API_KEY
docker compose up -d          # postgres carga schema.sql + seed.sql solo
# API:  http://localhost/api/v1   ·   Web: http://localhost
```

Credenciales demo del panel: `admin@eguardian.cl` / `Demo1234!`.

---

*eGuardian AI Concierge — MVP. Documento técnico para evaluación e
implementación. Construido para verse real, profesional, vendible y escalable.*
