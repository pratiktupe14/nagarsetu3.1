const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

let sqlite3 = null;
function getSqlite3() {
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NOW_REGION) {
    return null;
  }
  if (!sqlite3) {
    try {
      sqlite3 = require('sqlite3').verbose();
    } catch (e) {
      console.warn('[SQLITE NOTE] sqlite3 native module not loaded:', e.message);
      return null;
    }
  }
  return sqlite3;
}

let pgPool = null;
let sqliteDb = null;
let useSqlite = false;
let isInitializing = false;
let initPromise = null;

const DB_TYPE = (process.env.DB_TYPE || '').toLowerCase(); // 'postgres' or 'sqlite'

const seedDefaultUsers = require('../scripts/seedDefaultUsers');
const seedServiceStaff = require('../scripts/seedServiceStaff');
const seed7DemoDepartmentHeads = require('../scripts/seedDemoDepartmentHeads');

/**
 * Initialize PostgreSQL or local SQLite database.
 * NOTE: Serverless/Vercel environments MUST use persistent PostgreSQL.
 * Memory store fallbacks are strictly prohibited.
 */
function initDatabase() {
  if (initPromise) {
    return initPromise;
  }

  initPromise = new Promise(async (resolve, reject) => {
    const isVercel = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NOW_REGION);
    const isProduction = process.env.NODE_ENV === 'production';
    const dbUrl = (process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.SUPABASE_DB_URL || process.env.POSTGRES_URL_NON_POOLING || '').trim();
    const shouldBePostgres = isVercel || isProduction || DB_TYPE === 'postgres' || Boolean(dbUrl);

    const onInitDone = async () => {
      try {
        await seedDefaultUsers(query);
        await seed7DemoDepartmentHeads(query);
        await seedServiceStaff(query);
      } catch (e) {
        console.warn('[SEED INIT NOTE]', e.message);
      }
      resolve();
    };

    if (shouldBePostgres) {
      if (!dbUrl) {
        const errMsg = 'FATAL DATABASE ERROR: PostgreSQL connection string (DATABASE_URL / POSTGRES_URL) is required in Vercel/Production mode. In-memory fallback is disabled.';
        console.error(errMsg);
        return reject(new Error(errMsg));
      }

      console.log('Connecting to persistent PostgreSQL database...');
      try {
        if (!pgPool) {
          pgPool = new Pool({
            connectionString: dbUrl,
            ssl: { rejectUnauthorized: false },
            max: 10,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000
          });

          pgPool.on('error', (err) => {
            console.error('[POSTGRES POOL UNEXPECTED ERROR]:', err.message);
          });
        }

        // Verify connection with active query
        const testRes = await pgPool.query('SELECT NOW() as connected_at');
        console.log('PostgreSQL connected successfully at:', testRes.rows[0]?.connected_at);

        // Ensure all required persistent tables and columns exist
        await createTablesPostgres();
        useSqlite = false;
        await onInitDone();
      } catch (err) {
        console.error('FATAL POSTGRESQL CONNECTION ERROR:', err.message);
        // Clear cached pool on connection error so subsequent requests can re-attempt
        if (pgPool) {
          pgPool.end().catch(() => {});
          pgPool = null;
        }
        return reject(new Error(`Database Connection Failed: ${err.message}. Serverless memory fallback is disabled.`));
      }
    } else {
      // Local development SQLite mode (only allowed when NOT in Vercel and NOT in Production)
      console.log('Initializing local development SQLite database...');
      setupSqlite(onInitDone, reject);
    }
  });

  return initPromise;
}

async function createTablesPostgres() {
  try {
    // 1. Departments table
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS departments (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        code TEXT,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Users table
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        mobile TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'citizen',
        department_id INTEGER REFERENCES departments(id),
        employee_id TEXT,
        designation TEXT DEFAULT 'Field Service Staff',
        status TEXT DEFAULT 'active',
        language_pref TEXT DEFAULT 'en',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 3. Department Heads table
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS department_heads (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        department_id INTEGER REFERENCES departments(id),
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        phone TEXT,
        employee_id TEXT,
        designation TEXT DEFAULT 'Department Head',
        status TEXT DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 4. Field Staff table
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS field_staff (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        department_id INTEGER NOT NULL REFERENCES departments(id),
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        phone TEXT,
        employee_id TEXT UNIQUE NOT NULL,
        role TEXT DEFAULT 'field_staff',
        status TEXT DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 5. Complaints table
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS complaints (
        id SERIAL PRIMARY KEY,
        complaint_number TEXT,
        citizen_id INTEGER REFERENCES users(id),
        photo_before_url TEXT NOT NULL,
        photo_after_url TEXT,
        category TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        priority TEXT DEFAULT 'Medium',
        status TEXT DEFAULT 'Submitted',
        department_id INTEGER REFERENCES departments(id),
        assigned_staff_id TEXT,
        assigned_staff_name TEXT,
        assigned_staff_email TEXT,
        assigned_by INTEGER,
        assigned_by_name TEXT,
        sla_deadline TIMESTAMP,
        work_performed TEXT,
        materials_used TEXT,
        additional_notes TEXT,
        verified_by INTEGER,
        verified_by_name TEXT,
        verified_at TIMESTAMP,
        rework_reason TEXT,
        admin_rejection_reason TEXT,
        latitude DOUBLE PRECISION NOT NULL DEFAULT 0,
        longitude DOUBLE PRECISION NOT NULL DEFAULT 0,
        location_source TEXT NOT NULL DEFAULT 'manual_pin',
        location_address TEXT,
        duplicate_of_id INTEGER REFERENCES complaints(id),
        ai_category TEXT,
        ai_specific_issue TEXT,
        ai_confidence DOUBLE PRECISION,
        ai_severity TEXT,
        ai_urgency TEXT,
        ai_evidence TEXT,
        ai_model TEXT,
        ai_analyzed_at TIMESTAMP,
        needs_manual_verification INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Safe column migrations for PostgreSQL complaints table
    const safeAddPgCol = async (table, colDef) => {
      try { await pgPool.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${colDef};`); } catch (e) {}
    };

    await safeAddPgCol('departments', 'code TEXT');
    await safeAddPgCol('users', "designation TEXT DEFAULT 'Field Service Staff'");
    await safeAddPgCol('users', 'employee_id TEXT');
    await safeAddPgCol('users', "status TEXT DEFAULT 'active'");
    await safeAddPgCol('users', "language_pref TEXT DEFAULT 'en'");
    await safeAddPgCol('users', 'updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
    await safeAddPgCol('field_staff', 'user_id INTEGER');
    await safeAddPgCol('field_staff', 'department_id INTEGER');
    await safeAddPgCol('field_staff', "role TEXT DEFAULT 'field_staff'");
    await safeAddPgCol('field_staff', "status TEXT DEFAULT 'active'");

    await safeAddPgCol('complaints', 'complaint_number TEXT');
    await safeAddPgCol('complaints', 'assigned_staff_id TEXT');
    await safeAddPgCol('complaints', 'assigned_staff_name TEXT');
    await safeAddPgCol('complaints', 'assigned_staff_email TEXT');
    await safeAddPgCol('complaints', 'assigned_by INTEGER');
    await safeAddPgCol('complaints', 'assigned_by_name TEXT');
    await safeAddPgCol('complaints', 'sla_deadline TIMESTAMP');
    await safeAddPgCol('complaints', 'work_performed TEXT');
    await safeAddPgCol('complaints', 'materials_used TEXT');
    await safeAddPgCol('complaints', 'additional_notes TEXT');
    await safeAddPgCol('complaints', 'verified_by INTEGER');
    await safeAddPgCol('complaints', 'verified_by_name TEXT');
    await safeAddPgCol('complaints', 'verified_at TIMESTAMP');
    await safeAddPgCol('complaints', 'rework_reason TEXT');
    await safeAddPgCol('complaints', 'admin_rejection_reason TEXT');
    await safeAddPgCol('complaints', 'location_address TEXT');
    await safeAddPgCol('complaints', 'ai_category TEXT');
    await safeAddPgCol('complaints', 'ai_specific_issue TEXT');
    await safeAddPgCol('complaints', 'ai_confidence DOUBLE PRECISION');
    await safeAddPgCol('complaints', 'ai_severity TEXT');
    await safeAddPgCol('complaints', 'ai_urgency TEXT');
    await safeAddPgCol('complaints', 'ai_evidence TEXT');
    await safeAddPgCol('complaints', 'ai_model TEXT');
    await safeAddPgCol('complaints', 'ai_analyzed_at TIMESTAMP');
    await safeAddPgCol('complaints', 'needs_manual_verification INTEGER DEFAULT 0');

    // 6. Assignments table
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS assignments (
        id SERIAL PRIMARY KEY,
        complaint_id INTEGER REFERENCES complaints(id),
        staff_id INTEGER REFERENCES users(id),
        assigned_by INTEGER REFERENCES users(id),
        assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        resolved_at TIMESTAMP
      );
    `);

    // 7. Task assignments table
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS task_assignments (
        id SERIAL PRIMARY KEY,
        complaint_id INTEGER REFERENCES complaints(id),
        staff_id INTEGER REFERENCES users(id),
        assigned_by INTEGER REFERENCES users(id),
        status TEXT DEFAULT 'Assigned',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 8. Feedback tables
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS feedback (
        id SERIAL PRIMARY KEY,
        complaint_id INTEGER REFERENCES complaints(id),
        rating INTEGER CHECK (rating >= 1 AND rating <= 5),
        comment TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS complaint_feedback (
        id SERIAL PRIMARY KEY,
        complaint_id INTEGER REFERENCES complaints(id),
        rating INTEGER CHECK (rating >= 1 AND rating <= 5),
        comment TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 9. Notifications table
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        complaint_id INTEGER REFERENCES complaints(id),
        channel TEXT DEFAULT 'in_app',
        message TEXT NOT NULL,
        is_read INTEGER DEFAULT 0,
        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 10. Complaint status history table
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS complaint_status_history (
        id SERIAL PRIMARY KEY,
        complaint_id INTEGER REFERENCES complaints(id),
        status TEXT NOT NULL,
        remark TEXT,
        department TEXT,
        updated_by TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 11. Announcements table
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS announcements (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        type TEXT DEFAULT 'General',
        priority TEXT DEFAULT 'Medium',
        status TEXT DEFAULT 'Published',
        target_type TEXT DEFAULT 'all',
        target_audience TEXT DEFAULT 'all_departments',
        target_role TEXT,
        department_id INTEGER REFERENCES departments(id),
        department_name TEXT,
        created_by TEXT DEFAULT 'City Admin',
        posted_by TEXT DEFAULT 'City Admin',
        created_by_role TEXT DEFAULT 'city_admin',
        is_published INTEGER DEFAULT 1,
        published_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await safeAddPgCol('announcements', "status TEXT DEFAULT 'Published'");
    await safeAddPgCol('announcements', "target_audience TEXT DEFAULT 'all_departments'");
    await safeAddPgCol('announcements', 'target_role TEXT');
    await safeAddPgCol('announcements', "created_by_role TEXT DEFAULT 'city_admin'");
    await safeAddPgCol('announcements', 'expires_at TIMESTAMP');

    // 12. Announcement reads table
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS announcement_reads (
        id SERIAL PRIMARY KEY,
        announcement_id INTEGER REFERENCES announcements(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL,
        read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(announcement_id, user_id)
      );
    `);

    // 13. User roles table
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS user_roles (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        role TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 14. Profiles table
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS profiles (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        full_name TEXT,
        avatar_url TEXT,
        bio TEXT,
        address TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Seed default departments if table is empty
    const deptCheck = await pgPool.query('SELECT COUNT(*) as count FROM departments');
    if (parseInt(deptCheck.rows[0]?.count || 0, 10) === 0) {
      await pgPool.query(`
        INSERT INTO departments (id, name, code, description) VALUES
          (1, 'Public Works Department (PWD)', 'PWD', 'Road repairs, potholes, and asphalt infrastructure'),
          (2, 'Sanitation & Waste Management', 'SAN', 'Garbage pickup, trash overflow, and public cleanliness'),
          (3, 'Water Supply & Sewerage Board', 'WTR', 'Pipeline leakages, drainage overflows, and water supply'),
          (4, 'Drainage & Sewage Department', 'DRN', 'Drainage blockage, sewage overflow, open drains, and culverts'),
          (5, 'Electrical & Street Lighting', 'ELE', 'Streetlight repair, electrical poles, and public lighting'),
          (6, 'Traffic Management Department', 'TRF', 'Traffic signal repairs, road signage, and junction issues'),
          (7, 'Maintenance Department', 'MNT', 'General civic facility repairs, building maintenance, and public asset upkeep')
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          code = EXCLUDED.code,
          description = EXCLUDED.description;
      `);
    } else {
      await pgPool.query("UPDATE departments SET code = 'PWD' WHERE (code IS NULL OR code = '') AND (id = 1 OR name ILIKE '%Public Works%');").catch(() => {});
      await pgPool.query("UPDATE departments SET code = 'SAN' WHERE (code IS NULL OR code = '') AND (id = 2 OR name ILIKE '%Sanitation%');").catch(() => {});
      await pgPool.query("UPDATE departments SET code = 'WTR' WHERE (code IS NULL OR code = '') AND (id = 3 OR name ILIKE '%Water%');").catch(() => {});
      await pgPool.query("UPDATE departments SET code = 'DRN' WHERE (code IS NULL OR code = '') AND (id = 4 OR name ILIKE '%Drainage%');").catch(() => {});
      await pgPool.query("UPDATE departments SET code = 'ELE' WHERE (code IS NULL OR code = '') AND (id = 5 OR name ILIKE '%Electrical%');").catch(() => {});
      await pgPool.query("UPDATE departments SET code = 'TRF' WHERE (code IS NULL OR code = '') AND (id = 6 OR name ILIKE '%Traffic%');").catch(() => {});
      await pgPool.query("UPDATE departments SET code = 'MNT' WHERE (code IS NULL OR code = '') AND (id = 7 OR name ILIKE '%Maintenance%');").catch(() => {});
    }
  } catch (err) {
    console.error('Error creating PostgreSQL tables:', err);
    throw err;
  }
}

function setupSqlite(resolve, reject) {
  useSqlite = true;
  const isVercel = Boolean(process.env.VERCEL || process.env.NOW_REGION || process.env.AWS_LAMBDA_FUNCTION_NAME);
  if (isVercel) {
    const err = new Error('FATAL: Serverless environment detected. Persistent PostgreSQL (DATABASE_URL) is required.');
    console.error(err.message);
    return reject ? reject(err) : null;
  }

  const sqliteMod = getSqlite3();
  if (!sqliteMod) {
    const err = new Error('SQLite native module not available and in-memory storage is disabled.');
    console.error(err.message);
    return reject ? reject(err) : null;
  }

  const dbPath = path.join(__dirname, '../../nagarsetu.sqlite');
  try {
    sqliteDb = new sqliteMod.Database(dbPath, (err) => {
      if (err) {
        console.error('Error connecting to SQLite DB:', err.message);
        sqliteDb = null;
        return reject ? reject(err) : null;
      }
      console.log('Using local SQLite database at:', dbPath);
      createTablesSqlite().then(resolve).catch(reject);
    });
  } catch (err) {
    console.error('SQLite init exception:', err.message);
    sqliteDb = null;
    return reject ? reject(err) : null;
  }
}

function createTablesSqlite() {
  return new Promise((resolve, reject) => {
    sqliteDb.serialize(() => {
      sqliteDb.run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          mobile TEXT UNIQUE NOT NULL,
          email TEXT UNIQUE,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'citizen',
          department_id INTEGER,
          employee_id TEXT,
          status TEXT DEFAULT 'active',
          language_pref TEXT DEFAULT 'en',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      sqliteDb.run(`
        CREATE TABLE IF NOT EXISTS department_heads (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER,
          department_id INTEGER,
          name TEXT NOT NULL,
          email TEXT NOT NULL,
          phone TEXT,
          employee_id TEXT,
          designation TEXT DEFAULT 'Department Head',
          status TEXT DEFAULT 'active',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id),
          FOREIGN KEY (department_id) REFERENCES departments(id)
        );
      `);

      sqliteDb.run(`
        CREATE TABLE IF NOT EXISTS field_staff (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER,
          department_id INTEGER NOT NULL,
          name TEXT NOT NULL,
          email TEXT NOT NULL UNIQUE,
          phone TEXT,
          employee_id TEXT NOT NULL UNIQUE,
          role TEXT DEFAULT 'field_staff',
          status TEXT DEFAULT 'active',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id),
          FOREIGN KEY (department_id) REFERENCES departments(id)
        );
      `);

      const safeAddColumn = (table, colDef) => {
        sqliteDb.run(`ALTER TABLE ${table} ADD COLUMN ${colDef};`, () => {});
      };
      safeAddColumn('users', 'department_id INTEGER');
      safeAddColumn('users', 'employee_id TEXT');
      safeAddColumn('users', 'designation TEXT DEFAULT "Field Service Staff"');
      safeAddColumn('users', 'status TEXT DEFAULT "active"');
      safeAddColumn('users', 'updated_at DATETIME DEFAULT CURRENT_TIMESTAMP');
      safeAddColumn('field_staff', 'user_id INTEGER');
      safeAddColumn('field_staff', 'department_id INTEGER');
      safeAddColumn('field_staff', 'status TEXT DEFAULT "active"');
      safeAddColumn('complaints', 'location_address TEXT');
      safeAddColumn('complaints', 'complaint_number TEXT');
      safeAddColumn('complaints', 'assigned_staff_id TEXT');
      safeAddColumn('complaints', 'assigned_staff_name TEXT');
      safeAddColumn('complaints', 'assigned_staff_email TEXT');
      safeAddColumn('complaints', 'assigned_by INTEGER');
      safeAddColumn('complaints', 'assigned_by_name TEXT');
      safeAddColumn('complaints', 'sla_deadline DATETIME');
      safeAddColumn('complaints', 'work_performed TEXT');
      safeAddColumn('complaints', 'materials_used TEXT');
      safeAddColumn('complaints', 'additional_notes TEXT');
      safeAddColumn('complaints', 'verified_by INTEGER');
      safeAddColumn('complaints', 'verified_by_name TEXT');
      safeAddColumn('complaints', 'verified_at DATETIME');
      safeAddColumn('complaints', 'rework_reason TEXT');
      safeAddColumn('complaints', 'admin_rejection_reason TEXT');
      safeAddColumn('complaints', 'ai_category TEXT');
      safeAddColumn('complaints', 'ai_specific_issue TEXT');
      safeAddColumn('complaints', 'ai_confidence REAL');
      safeAddColumn('complaints', 'ai_severity TEXT');
      safeAddColumn('complaints', 'ai_urgency TEXT');
      safeAddColumn('complaints', 'ai_evidence TEXT');
      safeAddColumn('complaints', 'ai_model TEXT');
      safeAddColumn('complaints', 'ai_analyzed_at DATETIME');
      safeAddColumn('complaints', 'needs_manual_verification INTEGER DEFAULT 0');

      sqliteDb.run(`
        CREATE TABLE IF NOT EXISTS departments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          code TEXT,
          description TEXT
        );
      `);

      sqliteDb.run(`
        CREATE TABLE IF NOT EXISTS complaints (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          complaint_number TEXT,
          citizen_id INTEGER,
          photo_before_url TEXT NOT NULL,
          photo_after_url TEXT,
          category TEXT NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          priority TEXT DEFAULT 'Medium',
          status TEXT DEFAULT 'Submitted',
          department_id INTEGER,
          assigned_staff_id TEXT,
          assigned_staff_name TEXT,
          assigned_staff_email TEXT,
          assigned_by INTEGER,
          assigned_by_name TEXT,
          sla_deadline DATETIME,
          work_performed TEXT,
          materials_used TEXT,
          additional_notes TEXT,
          verified_by INTEGER,
          verified_by_name TEXT,
          verified_at DATETIME,
          latitude REAL NOT NULL,
          longitude REAL NOT NULL,
          location_source TEXT NOT NULL,
          duplicate_of_id INTEGER,
          ai_category TEXT,
          ai_specific_issue TEXT,
          ai_confidence REAL,
          ai_severity TEXT,
          ai_urgency TEXT,
          ai_evidence TEXT,
          ai_model TEXT,
          ai_analyzed_at DATETIME,
          needs_manual_verification INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (citizen_id) REFERENCES users(id),
          FOREIGN KEY (department_id) REFERENCES departments(id)
        );
      `);

      sqliteDb.run(`
        CREATE TABLE IF NOT EXISTS assignments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          complaint_id INTEGER,
          staff_id INTEGER,
          assigned_by INTEGER,
          assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          resolved_at DATETIME,
          FOREIGN KEY (complaint_id) REFERENCES complaints(id),
          FOREIGN KEY (staff_id) REFERENCES users(id),
          FOREIGN KEY (assigned_by) REFERENCES users(id)
        );
      `);

      sqliteDb.run(`
        CREATE TABLE IF NOT EXISTS feedback (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          complaint_id INTEGER,
          rating INTEGER CHECK (rating >= 1 AND rating <= 5),
          comment TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (complaint_id) REFERENCES complaints(id)
        );
      `);

      sqliteDb.run(`
        CREATE TABLE IF NOT EXISTS notifications (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER,
          complaint_id INTEGER,
          channel TEXT DEFAULT 'in_app',
          message TEXT NOT NULL,
          is_read INTEGER DEFAULT 0,
          sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id),
          FOREIGN KEY (complaint_id) REFERENCES complaints(id)
        );
      `);

      sqliteDb.run(`
        CREATE TABLE IF NOT EXISTS complaint_status_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          complaint_id INTEGER NOT NULL,
          status TEXT NOT NULL,
          remark TEXT,
          department TEXT,
          updated_by TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (complaint_id) REFERENCES complaints(id)
        );
      `);

      sqliteDb.run(`
        CREATE TABLE IF NOT EXISTS announcements (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          description TEXT NOT NULL,
          type TEXT DEFAULT 'General',
          priority TEXT DEFAULT 'Medium',
          status TEXT DEFAULT 'Published',
          target_type TEXT DEFAULT 'all',
          target_audience TEXT DEFAULT 'all_departments',
          target_role TEXT,
          department_id INTEGER,
          department_name TEXT,
          created_by TEXT DEFAULT 'City Admin',
          posted_by TEXT DEFAULT 'City Admin',
          created_by_role TEXT DEFAULT 'city_admin',
          is_published INTEGER DEFAULT 1,
          published_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          expires_at DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (department_id) REFERENCES departments(id)
        );
      `);

      const safeAddSqliteColumn = (table, colDef) => {
        sqliteDb.run(`ALTER TABLE ${table} ADD COLUMN ${colDef}`, () => {});
      };
      safeAddSqliteColumn('users', "designation TEXT DEFAULT 'Field Service Staff'");
      safeAddSqliteColumn('announcements', "status TEXT DEFAULT 'Published'");
      safeAddSqliteColumn('announcements', "target_audience TEXT DEFAULT 'all_departments'");
      safeAddSqliteColumn('announcements', 'target_role TEXT');
      safeAddSqliteColumn('announcements', "created_by_role TEXT DEFAULT 'city_admin'");
      safeAddSqliteColumn('announcements', 'expires_at DATETIME');
      safeAddSqliteColumn('departments', 'code TEXT');

      sqliteDb.run(`
        CREATE TABLE IF NOT EXISTS announcement_reads (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          announcement_id INTEGER NOT NULL,
          user_id TEXT NOT NULL,
          read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(announcement_id, user_id),
          FOREIGN KEY (announcement_id) REFERENCES announcements(id) ON DELETE CASCADE
        );
      `);

      sqliteDb.get("SELECT COUNT(*) as count FROM departments", (err, row) => {
        if (!err && row && row.count === 0) {
          const stmt = sqliteDb.prepare("INSERT INTO departments (id, name, code, description) VALUES (?, ?, ?, ?)");
          stmt.run(1, "Public Works Department (PWD)", "PWD", "Road repairs, potholes, and asphalt infrastructure");
          stmt.run(2, "Sanitation & Waste Management", "SAN", "Garbage pickup, trash overflow, and public cleanliness");
          stmt.run(3, "Water Supply & Sewerage Board", "WTR", "Pipeline leakages, drainage overflows, and water supply");
          stmt.run(4, "Drainage & Sewage Department", "DRN", "Drainage blockage, sewage overflow, open drains, and culverts");
          stmt.run(5, "Electrical & Street Lighting", "ELE", "Streetlight repair, electrical poles, and public lighting");
          stmt.run(6, "Traffic Management Department", "TRF", "Traffic signal repairs, road signage, and junction issues");
          stmt.run(7, "Maintenance Department", "MNT", "General civic facility repairs, building maintenance, and public asset upkeep");
          stmt.finalize();
        }

        sqliteDb.run("UPDATE departments SET code = 'PWD' WHERE id = 1 OR name LIKE '%Public Works%'");
        sqliteDb.run("UPDATE departments SET code = 'SAN' WHERE id = 2 OR name LIKE '%Sanitation%'");
        sqliteDb.run("UPDATE departments SET code = 'WTR' WHERE id = 3 OR name LIKE '%Water%'");
        sqliteDb.run("UPDATE departments SET code = 'DRN' WHERE id = 4 OR name LIKE '%Drainage%'");
        sqliteDb.run("UPDATE departments SET code = 'ELE' WHERE id = 5 OR name LIKE '%Electrical%'");
        sqliteDb.run("UPDATE departments SET code = 'TRF' WHERE id = 6 OR name LIKE '%Traffic%'");
        sqliteDb.run("UPDATE departments SET code = 'MNT' WHERE id = 7 OR name LIKE '%Maintenance%'");
        resolve();
      });
    });
  });
}

/**
 * Universal query runner wrapper.
 * Directly executes against PostgreSQL or SQLite.
 * Never silently switches to memory state.
 */
async function query(sql, params = []) {
  if (useSqlite) {
    if (!sqliteDb) {
      throw new Error('Database Error: SQLite database connection is unavailable.');
    }
    return new Promise((resolve, reject) => {
      let sqliteSql = sql;
      let sqliteParams = [];

      // Strip PostgreSQL RETURNING clause for SQLite run compatibility if needed
      if (!sqliteSql.trim().toUpperCase().startsWith('SELECT')) {
        sqliteSql = sqliteSql.replace(/\s+RETURNING\s+[\w*,\s]+/i, '');
      }

      if (/\$\d+/.test(sql)) {
        sqliteParams = [];
        sqliteSql = sqliteSql.replace(/\$(\d+)/g, (_, num) => {
          const idx = parseInt(num, 10) - 1;
          sqliteParams.push(params[idx]);
          return '?';
        });
      } else {
        sqliteParams = params;
      }

      const trimmedUpper = sqliteSql.trim().toUpperCase();
      const isSelect = trimmedUpper.startsWith('SELECT') || trimmedUpper.startsWith('PRAGMA') || trimmedUpper.startsWith('EXPLAIN');
      if (isSelect) {
        sqliteDb.all(sqliteSql, sqliteParams, (err, rows) => {
          if (err) return reject(err);
          resolve({ rows: rows || [], rowCount: (rows || []).length });
        });
      } else {
        sqliteDb.run(sqliteSql, sqliteParams, function (err) {
          if (err) return reject(err);
          const lastId = this.lastID;
          const rows = (lastId !== undefined && lastId !== null && lastId !== 0) ? [{ id: lastId }] : [];
          resolve({ rows, rowCount: this.changes || 0 });
        });
      }
    });
  } else {
    // Persistent PostgreSQL database query
    if (!pgPool) {
      // Lazy initialize if pool not ready
      await initDatabase();
    }
    if (!pgPool) {
      throw new Error('Database Error: PostgreSQL connection pool is uninitialized.');
    }

    let pgSql = sql;
    let paramIndex = 1;
    pgSql = pgSql.replace(/\?/g, () => `$${paramIndex++}`);

    const trimmed = pgSql.trim();
    if (trimmed.toUpperCase().startsWith('INSERT') && !trimmed.toUpperCase().includes('RETURNING')) {
      pgSql += ' RETURNING id';
    }

    try {
      return await pgPool.query(pgSql, params);
    } catch (err) {
      console.error('[DATABASE QUERY ERROR]', err.message);
      // DO NOT fall back to SQLite or memory store. Re-throw error so data consistency is preserved.
      throw err;
    }
  }
}

module.exports = {
  initDatabase,
  query,
  getIsSqlite: () => useSqlite
};
