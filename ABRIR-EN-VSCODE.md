# Abrir eGuardian en VS Code

## 1. Descomprimir
Descomprime `eguardian.zip`. Tendrás una carpeta `eguardian/`.

## 2. Abrir en VS Code
- Abre VS Code
- File → Open Folder… → selecciona la carpeta `eguardian/`
- (o desde terminal, dentro de la carpeta:)  `code .`

## 3. Inicializar Git (recomendado)
```bash
git init
git add .
git commit -m "MVP inicial eGuardian AI Concierge"
# y si quieres subirlo:
# git remote add origin <URL-de-tu-repo>
# git push -u origin main
```

## 4. Extensiones
Al abrir la carpeta, VS Code sugerirá las extensiones recomendadas
(panel inferior derecho). Acéptalas: incluyen PHP/Laravel, Tailwind,
ESLint, Docker y PostgreSQL.

## 5. Levantar el entorno de desarrollo
Opción A — todo con Docker (más simple):
```bash
cp .env.example .env        # completa OPENAI_API_KEY
docker compose up -d
# Web:  http://localhost     API: http://localhost/api/v1
```

Opción B — sin Docker, cada parte por separado:
```bash
# Backend
cd backend && composer install && php artisan migrate --seed && php artisan serve
# Frontend (otra terminal)
cd frontend && npm install && npm run dev
```

## Estructura
- `frontend/` — Next.js (tótem + panel)  ·  `Totem.jsx`, `AdminPanel.jsx`
- `backend/`  — Laravel 12 (API, servicios IA, modelos)
- `database/` — `schema.sql`, `seed.sql`
- `infra/`    — NGINX  ·  `docker-compose.yml`, `.env.example`
- `DEMO-Totem.html` — demo autónoma (doble clic, sin instalar)
- `README.md` — documentación técnica completa
