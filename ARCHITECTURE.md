# Portfolio Manager — Enterprise Architecture Summary

**Version:** 1.0  
**Date:** May 2026  
**Classification:** Internal — Technical

---

## Table of Contents

1. [Executive Overview](#1-executive-overview)
2. [System Architecture](#2-system-architecture)
3. [Technology Stack](#3-technology-stack)
4. [Component Architecture](#4-component-architecture)
5. [Data Architecture](#5-data-architecture)
6. [Authentication & Authorisation](#6-authentication--authorisation)
7. [Security Posture](#7-security-posture)
8. [API Architecture](#8-api-architecture)
9. [Integration Points](#9-integration-points)
10. [Infrastructure & Deployment](#10-infrastructure--deployment)
11. [Enterprise Deployment Guide](#11-enterprise-deployment-guide)
12. [Scalability & High Availability](#12-scalability--high-availability)
13. [Compliance & Audit Controls](#13-compliance--audit-controls)
14. [Monitoring & Observability](#14-monitoring--observability)
15. [Disaster Recovery](#15-disaster-recovery)

---

## 1. Executive Overview

**Portfolio Manager** is a full-stack, multi-tenant project portfolio management (PPM) platform designed for enterprise use. It provides end-to-end visibility across portfolios, programs, projects, and tasks — supporting both traditional waterfall and Agile delivery methodologies.

### Core Capabilities

| Capability | Description |
|---|---|
| Portfolio Hierarchy | Portfolio → Program → Project → Task with unlimited depth |
| Task Management | Dependencies, milestones, scheduling (ASAP/ALAP/constraint-based) |
| Agile (Scrum) | Sprint management, Agile phase boards, task types, burndown |
| Resource Management | Capacity planning, resource allocation, estimated vs. actual hours |
| Risk Management | Risk register with severity ratings and mitigation tracking |
| Schedule Engine | Critical path, Gantt charts, EVM (Earned Value Management), baselines |
| Reporting | Resource utilisation, risk reports, EVM analytics |
| AI Assistant | Natural language project creation, task charter parsing |
| Multi-Tenancy | Company-isolated data with role-based access per page |
| Audit Trail | Full activity log for compliance and change tracking |

### Deployment Footprint

```
┌──────────────────────────────────────────────────────────────┐
│                      INTERNET                                │
└──────────────────┬───────────────────────┬───────────────────┘
                   │                       │
         ┌─────────▼──────┐     ┌──────────▼────────┐
         │   Frontend SPA  │     │    REST API        │
         │   React / Vite  │────▶│    Laravel 12      │
         │   Vercel CDN    │     │    Railway / Docker │
         └────────────────┘     └──────────┬─────────┘
                                            │
                                 ┌──────────▼─────────┐
                                 │   PostgreSQL DB     │
                                 │  (managed or self-  │
                                 │   hosted)           │
                                 └────────────────────┘
```

---

## 2. System Architecture

### Architectural Pattern

**Three-tier, API-first SPA architecture**

- **Presentation tier:** React 18 single-page application served from a CDN. Communicates exclusively via REST over HTTPS.
- **Application tier:** Stateless Laravel 12 PHP API. All business logic, authorisation, and data orchestration lives here.
- **Data tier:** PostgreSQL relational database. Schema managed via Laravel migrations (idempotent, auto-applied on deploy).

### Key Design Decisions

| Decision | Rationale |
|---|---|
| Stateless API (JWT) | Horizontal scalability — no server-side session store required |
| HttpOnly cookie + Bearer fallback | XSS-resistant auth for browsers; backward-compat for API clients |
| Page-slug permission model | Fine-grained, UI-driven access control without code changes |
| Company-scoped multi-tenancy | Single deployment serves multiple tenants with data isolation |
| Idempotent migrations | Zero-downtime schema updates; safe to re-run on every deploy |
| Docker + nixpacks | Reproducible builds; portable across cloud providers |

### Communication Flow

```
Browser
  │
  ├── HTTPS GET /  → Vercel CDN → Static HTML/JS/CSS (SPA)
  │
  └── HTTPS API calls → Railway/Docker (Laravel)
        │  Authorization: Bearer <jwt>   (or HttpOnly cookie)
        │
        ├── GET  /api/projects      → ProjectController
        ├── POST /api/tasks         → TaskController
        ├── GET  /api/capacity      → CapacityController
        ├── POST /api/chat          → ChatController → OpenAI API
        └── GET  /api/reports/...   → ReportController
              │
              └── PostgreSQL (parameterised queries via Eloquent ORM)
```

---

## 3. Technology Stack

### Frontend

| Layer | Technology | Version |
|---|---|---|
| Framework | React | 18.2.0 |
| Build Tool | Vite | 7.3.3 |
| Routing | React Router DOM | 6.22.2 |
| UI Component Library | Material UI (MUI) | 9.0.0 |
| Styling | Emotion (CSS-in-JS) | Latest |
| HTTP Client | Axios | 1.6.7 |
| CDN / Hosting | Vercel | — |

### Backend (Production)

| Layer | Technology | Version |
|---|---|---|
| Runtime | PHP | 8.4 |
| Framework | Laravel | 12.0 |
| Authentication | tymon/jwt-auth (HMAC HS256) | 2.3 |
| HTTP Client | Guzzle | 7.10 |
| Database ORM | Eloquent | (Laravel built-in) |
| Container | Docker (php:8.4-cli) | — |
| Build System | Nixpacks | — |
| Hosting | Railway | — |

### Backend (Local Development)

| Layer | Technology | Version |
|---|---|---|
| Runtime | Node.js | 20+ |
| Framework | Express | 4.18.3 |
| Authentication | jsonwebtoken | 9.0.2 |
| Password Hashing | bcrypt | 5.1.1 |
| Security Headers | helmet | 7.1.0 |

### Data

| Environment | Database | Notes |
|---|---|---|
| Production | PostgreSQL | Managed (Railway Postgres) |
| Local development | SQLite | `backend-node/data/portfolio.db` |
| Seeding snapshot | SQLite | `backend/database/portfolio.db` |

### Infrastructure

| Service | Provider | Purpose |
|---|---|---|
| Frontend hosting | Vercel | CDN, edge deployment, SPA rewriting |
| Backend hosting | Railway | Container runtime, managed Postgres |
| Source control | GitHub | `KrS247/portfolio-manager` |
| AI (optional) | OpenAI API | Chat, charter parsing |
| Email (optional) | SMTP (configurable) | Password reset, notifications |
| ClickUp (optional) | ClickUp API | Task sync integration |

---

## 4. Component Architecture

### 4.1 Frontend — Pages & Modules

```
src/
├── pages/
│   ├── Dashboard.jsx          — KPIs, My Tasks, Milestones, Risk summary
│   ├── Portfolios.jsx         — Portfolio list + hierarchy drill-down
│   ├── Programs.jsx           — Program management
│   ├── Projects.jsx           — Project table (sortable, priority, status)
│   ├── Tasks.jsx              — Flat task list with filters
│   ├── Calendar.jsx           — Calendar day/week/month view
│   ├── Reports.jsx            — Resource utilisation, risk, EVM reports
│   ├── Capacity.jsx           — Capacity planning (weeks/months/sprints)
│   ├── RiskManagement.jsx     — Risk register
│   └── admin/
│       ├── Users.jsx          — User provisioning
│       ├── Roles.jsx          — Role management
│       ├── Permissions.jsx    — Page-level permission matrix
│       ├── Teams.jsx          — Team configuration
│       ├── CompanySetup.jsx   — Company settings, logo, branding
│       ├── WorkingCalendar.jsx — Business calendar, public holidays
│       ├── Companies.jsx      — Multi-tenancy company management
│       ├── AgilePhases.jsx    — Agile phase configuration
│       └── SprintManagement.jsx — Sprint creation and status
│
├── components/
│   ├── SprintBoard.jsx        — Kanban-style Agile board with phase rows
│   ├── TaskForm.jsx           — Full task editor (schedule, resources, agile)
│   ├── GanttChart.jsx         — Interactive Gantt with critical path
│   ├── PriorityBadge.jsx      — Priority indicator component
│   └── ...
│
└── api/
    └── client.js              — Axios instance, dual-token auth, 401 redirect
```

### 4.2 Backend — Module Structure

```
app/
├── Http/
│   ├── Controllers/           — 27 controllers (one per domain)
│   │   ├── AuthController     — Login, logout, register, password reset
│   │   ├── TaskController     — Full task CRUD + resources + dependencies
│   │   ├── ProjectController  — Project management
│   │   ├── SprintController   — Sprint lifecycle + status updates
│   │   ├── AgilePhaseController — Agile phase config + reordering
│   │   ├── CapacityController — Resource load across date ranges
│   │   ├── EVMController      — Earned Value Metrics computation
│   │   ├── ChatController     — AI charter parsing + project creation
│   │   ├── BackupController   — On-demand DB backup (admin only)
│   │   └── OnboardingController — Workspace setup wizard
│   │
│   └── Middleware/
│       ├── JwtAuthenticate    — Token resolution (cookie > header), user hydration
│       ├── Authorize          — Page-slug RBAC, admin bypass, company isolation
│       └── SecurityHeaders    — HSTS, CSP, X-Frame-Options, cache-control
│
├── Models/                    — 27 Eloquent models
│   ├── User                   — BelongsToTenant trait, role relationship
│   ├── Task                   — Polymorphic parent (project/program/portfolio)
│   ├── Sprint                 — status: planned | active | completed
│   ├── AgilePhase             — Ordered, renameable workflow stages
│   ├── PagePermission         — Role × Page × level (0=none, 1=view, 2=edit)
│   └── CompanyPermission      — Company-level feature flags
│
└── Console/Commands/
    └── SeedFromSnapshot       — Import SQLite snapshot → Postgres (with --force)
```

---

## 5. Data Architecture

### 5.1 Entity Relationship Overview

```
Company
  └── Portfolio
        └── Program
              └── Project (is_agile flag)
                    ├── Task (parent_type='project')
                    │     ├── Sub-tasks (parent_task_id)
                    │     ├── TaskResource (user allocations)
                    │     ├── TaskDependency (FS links)
                    │     └── TaskComment
                    └── Risk

Task ──── Sprint (sprint_id)
Task ──── AgilePhase (agile_phase_id)

User ──── Role ──── PagePermission ──── Page
User ──── Team
User ──── Company
User ──── UserWorkingCalendar ──── WorkingCalendarSetting
```

### 5.2 Key Tables

| Table | Rows (typical) | Purpose |
|---|---|---|
| `users` | 10–500 | Authenticated users with role and company |
| `projects` | 10–1000 | Core project records with agile flag |
| `tasks` | 100–50000 | All work items (polymorphic parent) |
| `task_resources` | 100–10000 | Per-task resource assignments with hours |
| `sprints` | 10–200 | Sprint metadata with date ranges and status |
| `agile_phases` | 10–30 | Ordered workflow stages for the Agile board |
| `page_permissions` | 20–200 | RBAC matrix (role × page × level) |
| `activity_logs` | 1000+ | Immutable audit trail |
| `risks` | 10–500 | Risk register entries |
| `schedule_baselines` | 1–50 | Snapshot of planned schedule for EVM |

### 5.3 Multi-Tenancy

Data isolation is enforced at the application layer via the `BelongsToTenant` model trait. Every query against tenant-scoped resources is automatically filtered by `company_id`. Company-level feature access is additionally governed by the `company_permissions` table.

---

## 6. Authentication & Authorisation

### 6.1 Authentication Flow

```
1. POST /api/auth/login  { email, password }
        │
        ▼
   AuthController: password_verify() against bcrypt hash
        │
        ├── FAIL → 401 Unauthorized
        │
        └── PASS → JWT issued (HS256, TTL: configurable, default 60 min)
                 │
                 ├── HttpOnly cookie: jwt_token  (browser clients)
                 └── JSON body: { token }        (API clients / legacy)

2. Subsequent requests:
   JwtAuthenticate middleware resolves token:
     Priority 1: Authorization: Bearer <token>  header
     Priority 2: jwt_token HttpOnly cookie
   → Hydrates $request->auth_user with fresh User + Role
```

### 6.2 Authorisation Model

```
Request → JwtAuthenticate → Authorize middleware
                                │
                                ├── Is user.role.is_admin? → ALLOW ALL
                                │
                                ├── Look up PagePermission
                                │     WHERE role_id = user.role_id
                                │       AND page.slug = route.slug
                                │
                                ├── Level 0 (none) → 403
                                ├── Level 1 (view) → GET allowed, POST/PUT/DELETE → 403
                                └── Level 2 (edit) → All methods allowed
```

**Permission levels per route example:**

| Route | Required Level |
|---|---|
| GET /api/projects | view (1) |
| POST /api/projects | edit (2) |
| GET /api/admin/users | admin.users view (1) |
| DELETE /api/admin/users/{id} | admin.users edit (2) |
| GET /api/backup/database | admin.dashboard edit (2) |

### 6.3 JWT Configuration

| Parameter | Default | Env Override |
|---|---|---|
| Algorithm | HS256 | `JWT_ALGO` |
| Access TTL | 60 minutes | `JWT_TTL` |
| Refresh TTL | 14 days | `JWT_REFRESH_TTL` |
| Secret | — | `JWT_SECRET` (required) |
| Blacklist | Enabled | `JWT_BLACKLIST_ENABLED` |
| Lock Subject | true | — (hardcoded) |

---

## 7. Security Posture

### 7.1 HTTP Security Headers (all API responses)

| Header | Value |
|---|---|
| Strict-Transport-Security | `max-age=31536000; includeSubDomains; preload` |
| Content-Security-Policy | `default-src 'none'; frame-ancestors 'none'` |
| X-Content-Type-Options | `nosniff` |
| X-Frame-Options | `DENY` |
| Referrer-Policy | `strict-origin-when-cross-origin` |
| Permissions-Policy | `geolocation=(), microphone=(), camera=(), payment=(), usb=()` |
| Cache-Control | `no-store, no-cache, must-revalidate` |
| X-Powered-By | *(removed)* |
| Server | *(removed)* |

### 7.2 Frontend Security Headers (Vercel)

| Header | Value |
|---|---|
| Content-Security-Policy | `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://portfolio-manager-backend-production-4df0.up.railway.app https://api.openai.com` |
| X-Content-Type-Options | `nosniff` |
| X-Frame-Options | `DENY` |
| Referrer-Policy | `strict-origin-when-cross-origin` |
| Permissions-Policy | `camera=(), microphone=(), geolocation=()` |

### 7.3 Input & Rate Limiting

| Endpoint | Rate Limit | Notes |
|---|---|---|
| POST /auth/login | `throttle:login` | Brute-force protection |
| POST /auth/forgot-password | `throttle:forgot-password` | Prevents enumeration |
| POST /auth/reset-password | `throttle:reset-password` | Token replay protection |
| POST /auth/register | `throttle:register` | Admin-triggered provisioning |
| GET /backup/database | `throttle:backup` | Prevent resource exhaustion |

### 7.4 Known Security Controls

| Control | Implementation |
|---|---|
| XSS (token theft) | JWT in HttpOnly cookie — inaccessible to JavaScript |
| CSRF | SameSite cookie attribute + CORS origin restriction |
| SQL Injection | Eloquent ORM with parameterised queries throughout |
| Mass assignment | `auth_user` stored in request attributes (not input bag) |
| Clickjacking | X-Frame-Options DENY + CSP frame-ancestors none |
| Information disclosure | X-Powered-By and Server headers stripped |
| Session fixation | JWT blacklisting on logout |
| Privilege escalation | `lock_subject: true` in JWT config |

---

## 8. API Architecture

### 8.1 API Design

- **Style:** RESTful JSON over HTTPS
- **Versioning:** Unversioned (implicit v1); recommend adding `/api/v1/` prefix for enterprise
- **Authentication:** Bearer JWT or HttpOnly cookie
- **Format:** `Content-Type: application/json` throughout
- **Error format:** Laravel default (status code + `message` key)
- **Base URL (production):** `https://portfolio-manager-backend-production-4df0.up.railway.app/api`

### 8.2 Endpoint Catalogue Summary

| Domain | Endpoints | Auth Required |
|---|---|---|
| Health | `GET /health`, `GET /logo` | No |
| Auth | `POST /auth/login`, `/logout`, `/register`, `/forgot-password`, `/reset-password` | Login: No; Others: Yes |
| Users & Roles | Full CRUD `/users`, `/roles`, `/permissions` | Yes — admin.users |
| Portfolios | Full CRUD `/portfolios` | Yes — portfolios |
| Programs | Full CRUD `/programs` | Yes — programs |
| Projects | Full CRUD `/projects` | Yes — projects |
| Tasks | Full CRUD + subtasks, deps, resources, comments | Yes — tasks |
| Risks | CRUD `/risks` | Yes — risks |
| Sprints | Full CRUD `/sprints` | Yes — admin.sprint-management |
| Agile Phases | Full CRUD + reorder `/agile-phases` | Yes — admin.agile-phases |
| Scheduling | `POST /schedule/run`, `GET /schedule/preview` | Yes — tasks |
| Baselines | CRUD `/baselines` | Yes — tasks |
| EVM | `GET /evm` | Yes — tasks |
| Capacity | `GET /capacity` | Yes — tasks |
| Reports | `GET /reports/resource-utilisation`, `/reports/risks` | Yes — tasks |
| Calendar | `GET /calendar` | Yes — tasks |
| Working Calendar | CRUD, holidays, user calendars | Yes — admin.company |
| Company Settings | `GET/POST /company-settings` | Yes — admin.company |
| Companies | Full CRUD `/companies` | Yes — admin.companies |
| Teams | Full CRUD `/teams` | Yes — admin.teams |
| AI Chat | `POST /chat`, `/chat/charter`, `/chat/charter/create` | Yes — tasks (edit) |
| Backup | `GET /backup/database` | Yes — admin.dashboard (edit) |
| Onboarding | Wizard steps `/onboarding/*` | Yes |

---

## 9. Integration Points

### 9.1 External APIs

| Integration | Purpose | Configuration |
|---|---|---|
| OpenAI API | AI chat, project charter parsing | `OPENAI_API_KEY` env var |
| ClickUp API | Task synchronisation | `CLICKUP_MCP_TOKEN` env var |
| SMTP Server | Password reset, notifications | `SMTP_*` env vars |

### 9.2 Internal Integrations

| Integration | Mechanism |
|---|---|
| Frontend ↔ Backend | REST over HTTPS, CORS-restricted |
| Backend ↔ Database | Eloquent ORM (PDO, parameterised) |
| Backend ↔ OpenAI | Guzzle HTTP client |
| Seed / Backup | SQLite snapshot bundled in Docker image |

---

## 10. Infrastructure & Deployment

### 10.1 Current Production Topology

```
GitHub (KrS247/portfolio-manager)
  │
  ├──[push main]──▶ Vercel        → https://frontend-krs247s-projects.vercel.app
  │                    Build: npm run build (Vite)
  │                    Serve: Static SPA from CDN edge
  │
  └──[railway up]──▶ Railway      → https://portfolio-manager-backend-production-4df0.up.railway.app
                         Build: Docker (php:8.4-cli)
                         Start: migrate --force → seed:from-snapshot → php artisan serve
                         DB:    Railway managed PostgreSQL
```

### 10.2 Environment Variables

#### Backend (Required)

| Variable | Description |
|---|---|
| `APP_KEY` | Laravel application key (base64:... format) |
| `APP_ENV` | `production` |
| `APP_URL` | Public API URL |
| `DB_URL` | PostgreSQL connection string |
| `DB_CONNECTION` | `pgsql` |
| `JWT_SECRET` | HMAC secret for JWT signing (min 256-bit) |
| `JWT_TTL` | Token TTL in minutes (e.g., `60`) |
| `FRONTEND_ORIGIN` | Allowed CORS origin (frontend URL) |

#### Backend (Optional)

| Variable | Description |
|---|---|
| `OPENAI_API_KEY` | Required for AI chat features |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | Email delivery |
| `CLICKUP_MCP_TOKEN` | ClickUp sync integration |
| `BACKUP_TOKEN` | Authorisation token for backup endpoint |
| `LOG_LEVEL` | `debug` / `info` / `warning` / `error` |
| `JWT_REFRESH_TTL` | Refresh window in minutes (default: 20160 = 14 days) |

#### Frontend (Build-time)

| Variable | Description |
|---|---|
| `VITE_API_URL` | Backend API base URL |

---

## 11. Enterprise Deployment Guide

### 11.1 Recommended Enterprise Topology

```
                        ┌─────────────────────────────┐
                        │       Corporate Network      │
                        │                             │
   Users ─── VPN/SSO ──▶│  ┌──────────┐  ┌────────┐  │
                        │  │  WAF /   │  │  Load  │  │
                        │  │  DDoS    │──▶ Balancer│  │
                        │  │  (e.g.   │  │(Nginx/ │  │
                        │  │  CF/AWS) │  │HAProxy)│  │
                        │  └──────────┘  └───┬────┘  │
                        │                    │       │
                        │         ┌──────────▼──────┐ │
                        │         │  API Containers  │ │
                        │         │  (2+ replicas)  │ │
                        │         │  Laravel 12 PHP  │ │
                        │         └──────────┬───────┘ │
                        │                    │        │
                        │         ┌──────────▼──────┐ │
                        │         │  PostgreSQL HA   │ │
                        │         │  Primary + Read  │ │
                        │         │  Replica         │ │
                        │         └─────────────────┘ │
                        └─────────────────────────────┘
```

### 11.2 Step-by-Step Deployment

#### Step 1 — Database

1. Provision PostgreSQL 15+ (recommended: AWS RDS, Azure Database, GCP Cloud SQL, or self-hosted)
2. Create a dedicated `portfolio_manager` database and a least-privilege user
3. Note the connection string: `postgresql://user:pass@host:5432/portfolio_manager`

#### Step 2 — Backend Container

Build and push the Docker image:

```bash
cd backend/
docker build -t portfolio-manager-api:latest .
docker push <your-registry>/portfolio-manager-api:latest
```

Required environment variables at runtime:

```env
APP_ENV=production
APP_KEY=base64:<generate with: php artisan key:generate --show>
APP_URL=https://api.yourdomain.com
DB_CONNECTION=pgsql
DB_URL=postgresql://user:pass@host:5432/portfolio_manager
JWT_SECRET=<min 64-char random secret>
JWT_TTL=60
FRONTEND_ORIGIN=https://app.yourdomain.com
LOG_LEVEL=info
```

On first run, the container automatically:
- Applies all database migrations (`php artisan migrate --force`)
- Seeds initial data from the bundled SQLite snapshot (if DB is empty)
- Starts serving on `$PORT` (default 8080)

#### Step 3 — Frontend

Build and deploy to any static hosting:

```bash
cd frontend/
VITE_API_URL=https://api.yourdomain.com/api npm run build
# Deploy dist/ to S3 + CloudFront, Azure Static Web Apps, Nginx, etc.
```

Alternatively, use the included `vercel.json` for Vercel deployment.  
For AWS Amplify, use the included `amplify.yml`.

#### Step 4 — Verify

```bash
curl https://api.yourdomain.com/api/health
# Expected: {"status":"ok","timestamp":"..."}
```

#### Step 5 — First Login

The default admin account is seeded from the snapshot. For a clean enterprise install:
1. Log in with the seeded admin credentials
2. Navigate to Admin → Company Setup to configure the organisation
3. Navigate to Admin → Users to provision enterprise users
4. Navigate to Admin → Roles & Permissions to configure the access matrix

### 11.3 Docker Compose (Self-Hosted)

```yaml
version: '3.9'
services:
  db:
    image: postgres:15
    environment:
      POSTGRES_DB: portfolio_manager
      POSTGRES_USER: pmuser
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD", "pg_isready", "-U", "pmuser"]
      interval: 5s
      retries: 10

  api:
    image: portfolio-manager-api:latest
    ports:
      - "8080:8080"
    environment:
      APP_ENV: production
      APP_KEY: ${APP_KEY}
      DB_CONNECTION: pgsql
      DB_URL: postgresql://pmuser:${DB_PASSWORD}@db:5432/portfolio_manager
      JWT_SECRET: ${JWT_SECRET}
      FRONTEND_ORIGIN: ${FRONTEND_ORIGIN}
    depends_on:
      db:
        condition: service_healthy

  frontend:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./frontend/dist:/usr/share/nginx/html:ro
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
    depends_on:
      - api

volumes:
  pgdata:
```

### 11.4 Enterprise SSO / LDAP Integration

The current authentication uses bcrypt-hashed passwords with JWT. For enterprise SSO:

- **SAML 2.0 / OIDC:** Integrate via `socialiteproviders/saml2` or `laravel/socialite` (requires backend changes to `AuthController`)
- **LDAP / Active Directory:** Integrate via `directorytree/ldaprecord-laravel`
- **Recommendation:** Replace the login endpoint with an OIDC authorization code flow; retain JWT issuance post-auth for API access

---

## 12. Scalability & High Availability

### 12.1 Stateless API

The backend is fully stateless — JWT tokens carry all session state. This enables:
- Horizontal scaling (add replicas behind a load balancer with zero configuration)
- Zero-downtime deploys (rolling updates)
- No sticky sessions required

### 12.2 Database

| Concern | Recommendation |
|---|---|
| Connection pooling | Use PgBouncer in transaction mode (target: 20 app connections → 1000 user connections) |
| Read scaling | Add read replica; route GET /reports, /capacity, /evm queries to replica |
| Backups | Enable automated PostgreSQL WAL streaming backups (point-in-time recovery) |
| Storage | Tasks table grows ~50–200 rows/day per active project; plan 50 GB+ for large deployments |

### 12.3 Caching

Current: None (every request hits the database).

Recommended additions:

| Cache Target | TTL | Mechanism |
|---|---|---|
| `GET /api/permissions/me` | 5 min | Redis / Memcached |
| `GET /api/agile-phases` | 10 min | Redis |
| `GET /api/sprints` | 5 min | Redis |
| JWT blacklist | TTL of token | Redis (replace database blacklist) |

Add `REDIS_URL` env var and configure `config/cache.php` to use Redis driver.

### 12.4 Expected Performance (single container, Postgres)

| Scenario | Target |
|---|---|
| API health check | < 5 ms |
| Project list (100 projects) | < 100 ms |
| Task list with resources (500 tasks) | < 300 ms |
| Capacity report (12 weeks, 20 users) | < 500 ms |
| Schedule calculation (200 tasks) | < 1000 ms |

---

## 13. Compliance & Audit Controls

### 13.1 SOC 2 Type II Mapping

| Control | Implementation |
|---|---|
| CC6.1 — Logical access controls | JWT + RBAC page permissions |
| CC6.2 — User provisioning | Admin-only registration endpoint |
| CC6.3 — Role management | Role CRUD with page-permission matrix |
| CC6.7 — Transmission security | HTTPS enforced, HSTS preload enabled |
| CC7.2 — Audit logging | `activity_logs` table with IP, user, action, resource |
| CC9.2 — Backup | On-demand DB backup endpoint (admin, throttled) |

### 13.2 ISO 27001 Mapping

| Control | Implementation |
|---|---|
| A.5.16 — Identity management | User + role lifecycle via Admin UI |
| A.5.18 — Access rights | Page-level permission matrix, company isolation |
| A.8.3 — Information access restriction | CompanyPermission table; admin.company,view |
| A.8.5 — Secure authentication | bcrypt + JWT, brute-force rate limiting |
| A.8.12 — Information leakage | `no-store` Cache-Control; stripped Server headers |
| A.8.15 — Audit logging | Authorization denials logged with SOC2 references |
| A.8.28 — Secure coding | OWASP-aligned headers; parameterised queries |

### 13.3 Audit Log Schema

The `activity_logs` table captures:

| Column | Description |
|---|---|
| `user_id` | Who performed the action |
| `action` | create / update / delete / view |
| `resource_type` | Entity type (project, task, user, etc.) |
| `resource_id` | Entity ID |
| `changes` | JSON diff of before/after values |
| `ip_address` | Client IP |
| `user_agent` | Browser / API client string |
| `created_at` | Timestamp (immutable) |

Logs are **append-only** — no update or delete routes are exposed for activity_logs.

---

## 14. Monitoring & Observability

### 14.1 Current Instrumentation

| Signal | Source |
|---|---|
| HTTP request logs | Laravel access log (stdout → Railway/Docker logs) |
| Application errors | Laravel `LOG_LEVEL` env (default: info) |
| Authorisation denials | Logged via `Log::warning()` with SOC2 reference |
| Health check | `GET /api/health` → `{"status":"ok","timestamp":"..."}` |

### 14.2 Recommended Enterprise Additions

| Concern | Tool | Integration Point |
|---|---|---|
| APM / tracing | New Relic, Datadog, or OpenTelemetry | Laravel middleware or `telescope` package |
| Error tracking | Sentry | `SENTRY_DSN` env var + `sentry/sentry-laravel` |
| Metrics | Prometheus + Grafana | `/metrics` endpoint via `spatie/prometheus` |
| Uptime monitoring | PagerDuty / StatusCake | `GET /api/health` endpoint |
| Log aggregation | ELK Stack / Splunk | Forward Docker stdout to log shipper |
| DB monitoring | pgBadger / pg_stat_statements | Enable on PostgreSQL |

### 14.3 Key Metrics to Monitor

| Metric | Alert Threshold |
|---|---|
| API response time (p95) | > 2000 ms |
| 5xx error rate | > 1% |
| JWT auth failure rate | > 10/min (potential brute force) |
| DB connection pool exhaustion | > 80% |
| Disk usage (DB) | > 80% |
| Memory (PHP process) | > 512 MB |

---

## 15. Disaster Recovery

### 15.1 Recovery Objectives

| Objective | Target |
|---|---|
| RTO (Recovery Time Objective) | < 30 minutes |
| RPO (Recovery Point Objective) | < 1 hour (with continuous WAL streaming) |

### 15.2 Backup Strategy

| Backup Type | Frequency | Retention | Storage |
|---|---|---|---|
| Full PostgreSQL dump | Daily | 30 days | Encrypted S3 / object storage |
| WAL streaming (PITR) | Continuous | 7 days | Same region + cross-region |
| Application DB snapshot | On-demand | Manual | Via `GET /api/backup/database` |
| SQLite seed snapshot | Per commit | Git history | `backend/database/portfolio.db` |

### 15.3 Recovery Procedure

1. Restore PostgreSQL from latest backup to a new instance
2. Update `DB_URL` environment variable in the backend service
3. Redeploy the backend container — migrations are idempotent and safe to re-run
4. Verify via `GET /api/health` and a test login

### 15.4 Zero-Downtime Deployment

Because the API is stateless and migrations are idempotent:

1. Deploy new container version alongside current (blue-green)
2. New container runs `php artisan migrate --force` (additive, non-destructive)
3. Switch load balancer traffic to new containers
4. Terminate old containers

No maintenance window required for schema changes (additive migrations only).

---

## Appendix A — Port & Network Reference

| Service | Port | Protocol | Notes |
|---|---|---|---|
| Frontend (dev) | 5173 | HTTP | Vite dev server |
| Backend (prod) | 8080 | HTTP | Served by `php artisan serve` |
| Backend (dev) | 3001 | HTTP | Node.js Express dev server |
| PostgreSQL | 5432 | TCP | Standard Postgres port |
| SMTP | 587 | TCP/STARTTLS | Configurable |

---

## Appendix B — Glossary

| Term | Definition |
|---|---|
| PPM | Project Portfolio Management |
| EVM | Earned Value Management — measures project performance vs. baseline |
| RBAC | Role-Based Access Control |
| Agile Phase | A workflow stage in the Agile board (e.g., Backlog, In Progress, Done) |
| Sprint | A time-boxed delivery iteration (status: Planned / Active / Completed) |
| Baseline | A saved snapshot of the planned schedule used for EVM comparison |
| BelongsToTenant | Model trait that auto-scopes all queries to the current company |
| SPA | Single-Page Application — the React frontend |
| JWT | JSON Web Token — stateless auth token signed with HMAC HS256 |
| PITR | Point-In-Time Recovery — database backup strategy |

---

*Document generated from codebase inspection — May 2026.*  
*For deployment support, refer to `README.md` and `nixpacks.toml` in the repository.*
