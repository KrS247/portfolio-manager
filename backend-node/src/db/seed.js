const bcrypt = require('bcrypt');
const db = require('./database');
const config = require('../config');

const PAGES = [
  { name: 'Dashboard',       slug: 'dashboard',          description: 'Main overview dashboard' },
  { name: 'Portfolios',      slug: 'portfolios',          description: 'Portfolio management' },
  { name: 'Programs',        slug: 'programs',            description: 'Program management' },
  { name: 'Projects',        slug: 'projects',            description: 'Project management' },
  { name: 'Tasks',           slug: 'tasks',               description: 'Task management' },
  { name: 'Admin: Users',    slug: 'admin.users',         description: 'User administration' },
  { name: 'Admin: Roles',    slug: 'admin.roles',         description: 'Role administration' },
  { name: 'Admin: Permissions', slug: 'admin.permissions', description: 'Permission matrix' },
  { name: 'Admin: Dashboard',   slug: 'admin.dashboard',  description: 'Dashboard schedule order' },
];

const ROLES = [
  { name: 'admin',   description: 'Full system access',        is_admin: 1 },
  { name: 'member',  description: 'Can create and edit work',  is_admin: 0 },
  { name: 'viewer',  description: 'Read-only access',          is_admin: 0 },
];

// Default permissions per role per page
const ROLE_PERMISSIONS = {
  admin:  () => 'edit',   // admin bypass handles this, but we set it anyway
  member: (slug) => slug.startsWith('admin.') ? 'none' : 'edit',
  viewer: (slug) => slug.startsWith('admin.') ? 'none' : 'view',
};

async function seed() {
  // Check if already seeded
  const existingAdmin = db.prepare("SELECT id FROM roles WHERE name = 'admin'").get();
  if (existingAdmin) {
    console.log('[DB] Seed already applied, skipping');
    return;
  }

  console.log('[DB] Running seed...');

  // Insert roles
  const insertRole = db.prepare(
    'INSERT INTO roles (name, description, is_admin) VALUES (?, ?, ?)'
  );
  for (const role of ROLES) {
    insertRole.run(role.name, role.description, role.is_admin);
  }

  // Insert pages
  const insertPage = db.prepare(
    'INSERT INTO pages (name, slug, description) VALUES (?, ?, ?)'
  );
  for (const page of PAGES) {
    insertPage.run(page.name, page.slug, page.description);
  }

  // Insert page permissions for each role
  const allRoles = db.prepare('SELECT id, name FROM roles').all();
  const allPages = db.prepare('SELECT id, slug FROM pages').all();

  const insertPerm = db.prepare(
    'INSERT INTO page_permissions (role_id, page_id, access_level) VALUES (?, ?, ?)'
  );

  for (const role of allRoles) {
    const permFn = ROLE_PERMISSIONS[role.name];
    if (!permFn) continue;
    for (const page of allPages) {
      insertPerm.run(role.id, page.id, permFn(page.slug));
    }
  }

  // Create bootstrap admin user
  const adminRole = db.prepare("SELECT id FROM roles WHERE name = 'admin'").get();
  const passwordHash = await bcrypt.hash(config.adminInitialPassword, 12);
  db.prepare(
    'INSERT INTO users (username, email, password_hash, role_id) VALUES (?, ?, ?, ?)'
  ).run('admin', 'admin@localhost', passwordHash, adminRole.id);

  console.log('[DB] Seed complete — admin user created (username: admin)');
}

module.exports = seed;
