PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ─── ROLES ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS roles (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL UNIQUE,
    description TEXT,
    is_admin    INTEGER NOT NULL DEFAULT 0
);

-- ─── USERS ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT    NOT NULL UNIQUE,
    email         TEXT    NOT NULL UNIQUE,
    password_hash TEXT    NOT NULL,
    role_id       INTEGER NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT
);

-- ─── PAGES ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pages (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    slug        TEXT    NOT NULL UNIQUE,
    description TEXT
);

-- ─── PAGE PERMISSIONS ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS page_permissions (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    role_id      INTEGER NOT NULL REFERENCES roles(id)  ON DELETE CASCADE,
    page_id      INTEGER NOT NULL REFERENCES pages(id)  ON DELETE CASCADE,
    access_level TEXT    NOT NULL DEFAULT 'none'
        CHECK (access_level IN ('none', 'view', 'edit')),
    UNIQUE (role_id, page_id)
);

-- ─── PORTFOLIOS ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS portfolios (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    description TEXT,
    status      TEXT    NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'on_hold', 'closed')),
    priority    INTEGER NOT NULL DEFAULT 5
        CHECK (priority BETWEEN 1 AND 10),
    start_date  TEXT,
    end_date    TEXT,
    owner_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ─── PROGRAMS ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS programs (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    portfolio_id INTEGER NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
    name         TEXT    NOT NULL,
    description  TEXT,
    status       TEXT    NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'on_hold', 'closed')),
    priority     INTEGER NOT NULL DEFAULT 5
        CHECK (priority BETWEEN 1 AND 10),
    start_date   TEXT,
    end_date     TEXT,
    owner_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ─── PROJECTS ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    program_id  INTEGER NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    name        TEXT    NOT NULL,
    description TEXT,
    status      TEXT    NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'on_hold', 'closed')),
    priority    INTEGER NOT NULL DEFAULT 5
        CHECK (priority BETWEEN 1 AND 10),
    start_date  TEXT,
    end_date    TEXT,
    owner_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ─── TASKS ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT    NOT NULL,
    description TEXT,
    priority    INTEGER NOT NULL DEFAULT 5
        CHECK (priority BETWEEN 1 AND 10),
    sequence    INTEGER NOT NULL DEFAULT 0,
    status      TEXT    NOT NULL DEFAULT 'open'
        CHECK (status IN ('open', 'in_progress', 'completed', 'cancelled')),
    percent_complete INTEGER NOT NULL DEFAULT 0
        CHECK (percent_complete BETWEEN 0 AND 100),
    start_date   TEXT,
    due_date     TEXT,
    is_milestone INTEGER NOT NULL DEFAULT 0,
    assigned_to     INTEGER REFERENCES users(id) ON DELETE SET NULL,
    parent_task_id  INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
    parent_type TEXT    NOT NULL
        CHECK (parent_type IN ('portfolio', 'program', 'project')),
    parent_id   INTEGER NOT NULL,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ─── RISKS ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS risks (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id         INTEGER NOT NULL UNIQUE REFERENCES tasks(id) ON DELETE CASCADE,
    name            TEXT    NOT NULL,
    description     TEXT,
    probability     INTEGER NOT NULL DEFAULT 1
        CHECK (probability BETWEEN 1 AND 5),
    impact          INTEGER NOT NULL DEFAULT 1
        CHECK (impact BETWEEN 1 AND 5),
    risk_rate       INTEGER NOT NULL,
    risk_status     TEXT    NOT NULL
        CHECK (risk_status IN ('Low Risk', 'Medium Risk', 'High Risk', 'Critical Risk')),
    mitigation_plan TEXT,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT
);

-- ─── TASK RESOURCES (multi-user allocation) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS task_resources (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id         INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    estimated_hours REAL,
    actual_hours    REAL,
    UNIQUE (task_id, user_id)
);

-- ─── TASK DEPENDENCIES ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS task_dependencies (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id      INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    depends_on   INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    UNIQUE (task_id, depends_on),
    CHECK (task_id != depends_on)
);

-- ─── PASSWORD RESET TOKENS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token      TEXT    NOT NULL UNIQUE,
    expires_at TEXT    NOT NULL,
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ─── TEAMS ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS teams (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL UNIQUE,
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ─── COMPANY SETTINGS ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS company_settings (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    company_name TEXT,
    logo_path    TEXT,
    updated_at   TEXT
);

-- ─── INDEXES ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_programs_portfolio ON programs(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_projects_program   ON projects(program_id);
CREATE INDEX IF NOT EXISTS idx_tasks_parent       ON tasks(parent_type, parent_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned     ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_risks_task         ON risks(task_id);
CREATE INDEX IF NOT EXISTS idx_task_deps_task     ON task_dependencies(task_id);
CREATE INDEX IF NOT EXISTS idx_task_deps_depends  ON task_dependencies(depends_on);
CREATE INDEX IF NOT EXISTS idx_task_resources_task ON task_resources(task_id);
CREATE INDEX IF NOT EXISTS idx_task_resources_user ON task_resources(user_id);
CREATE INDEX IF NOT EXISTS idx_users_role         ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_page_perms_role    ON page_permissions(role_id);
