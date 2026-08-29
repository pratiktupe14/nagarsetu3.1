const { Pool } = require('pg');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

let pgPool = null;
let sqliteDb = null;
let useSqlite = false;

const DB_TYPE = process.env.DB_TYPE || 'sqlite'; // 'postgres' or 'sqlite'

function initDatabase() {
  return new Promise((resolve, reject) => {
    const isProduction = process.env.NODE_ENV === 'production';
    const isPostgres = DB_TYPE === 'postgres' || isProduction;

    if (isPostgres && process.env.DATABASE_URL) {
      console.log('Connecting to PostgreSQL database...');
      pgPool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      });
      pgPool.query('SELECT NOW()', (err, res) => {
        if (err) {
          console.error('FATAL DATABASE ERROR: PostgreSQL connection failed:', err.message);
          if (isProduction || DB_TYPE === 'postgres') {
            return reject(new Error(`Database connection failed: ${err.message}. Automatic SQLite fallback is disabled in PostgreSQL/Production mode.`));
          }
          console.warn('Falling back to SQLite for local development only...');
          setupSqlite(resolve, reject);
        } else {
          console.log('PostgreSQL connected successfully.');
          createTablesPostgres().then(resolve).catch(reject);
        }
      });
    } else {
      if (isProduction) {
        return reject(new Error('FATAL DATABASE ERROR: DATABASE_URL environment variable is missing in production.'));
      }
      console.log('Initializing local development SQLite database...');
      setupSqlite(resolve, reject);
    }
  });
}

async function createTablesPostgres() {
  try {
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS departments (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

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
        status TEXT DEFAULT 'active',
        language_pref TEXT DEFAULT 'en',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

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

    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS complaints (
        id SERIAL PRIMARY KEY,
        citizen_id INTEGER REFERENCES users(id),
        photo_before_url TEXT NOT NULL,
        photo_after_url TEXT,
        category TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        priority TEXT DEFAULT 'Medium',
        status TEXT DEFAULT 'Submitted',
        department_id INTEGER REFERENCES departments(id),
        latitude DOUBLE PRECISION NOT NULL DEFAULT 0,
        longitude DOUBLE PRECISION NOT NULL DEFAULT 0,
        location_source TEXT NOT NULL DEFAULT 'manual_pin',
        location_address TEXT,
        duplicate_of_id INTEGER REFERENCES complaints(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

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

    const deptCheck = await pgPool.query('SELECT COUNT(*) as count FROM departments');
    if (parseInt(deptCheck.rows[0].count, 10) === 0) {
      await pgPool.query(`
        INSERT INTO departments (id, name, description) VALUES
          (1, 'Public Works Department (PWD)', 'Road repairs, potholes, and asphalt infrastructure'),
          (2, 'Sanitation & Waste Management', 'Garbage pickup, trash overflow, and public cleanliness'),
          (3, 'Water Supply & Sewerage Board', 'Pipeline leakages, drainage overflows, and water supply'),
          (4, 'Drainage & Sewage Department', 'Drainage blockage, sewage overflow, open drains, and culverts'),
          (5, 'Electrical & Street Lighting', 'Streetlight repair, electrical poles, and public lighting'),
          (6, 'Traffic Management Department', 'Traffic signal repairs, road signage, and junction issues'),
          (7, 'Maintenance Department', 'General civic facility repairs, building maintenance, and public asset upkeep')
        ON CONFLICT (id) DO NOTHING;
      `);
    }
  } catch (err) {
    console.error('Error creating PostgreSQL tables:', err);
  }
}


function setupSqlite(resolve, reject) {
  useSqlite = true;
  const dbPath = path.join(__dirname, '../../nagarsetu.sqlite');
  sqliteDb = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('Error connecting to SQLite DB:', err);
      return reject(err);
    }
    console.log('Using SQLite local database at:', dbPath);
    createTablesSqlite().then(resolve).catch(reject);
  });
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

      // Safe column additions for existing databases
      const safeAddColumn = (table, colDef) => {
        sqliteDb.run(`ALTER TABLE ${table} ADD COLUMN ${colDef};`, () => {});
      };
      safeAddColumn('users', 'department_id INTEGER');
      safeAddColumn('users', 'employee_id TEXT');
      safeAddColumn('users', 'status TEXT DEFAULT "active"');
      safeAddColumn('complaints', 'location_address TEXT');

      sqliteDb.run(`
        CREATE TABLE IF NOT EXISTS departments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT
        );
      `);

      sqliteDb.run(`
        CREATE TABLE IF NOT EXISTS complaints (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          citizen_id INTEGER,
          photo_before_url TEXT NOT NULL,
          photo_after_url TEXT,
          category TEXT NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          priority TEXT DEFAULT 'Medium',
          status TEXT DEFAULT 'Submitted',
          department_id INTEGER,
          latitude REAL NOT NULL,
          longitude REAL NOT NULL,
          location_source TEXT NOT NULL,
          duplicate_of_id INTEGER,
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

      // Seed initial default departments if empty
      sqliteDb.get("SELECT COUNT(*) as count FROM departments", (err, row) => {
        if (!err && row && row.count === 0) {
          const stmt = sqliteDb.prepare("INSERT INTO departments (name, description) VALUES (?, ?)");
          stmt.run("Public Works Department (PWD)", "Road repairs, potholes, and asphalt infrastructure");
          stmt.run("Sanitation & Waste Management", "Garbage pickup, trash overflow, and public cleanliness");
          stmt.run("Water Supply & Sewerage Board", "Pipeline leakages, drainage overflows, and water supply");
          stmt.run("Drainage & Sewage Department", "Drainage blockage, sewage overflow, open drains, and culverts");
          stmt.run("Electrical & Street Lighting", "Streetlight repair, electrical poles, and public lighting");
          stmt.run("Traffic Management Department", "Traffic signal repairs, road signage, and junction issues");
          stmt.run("Maintenance Department", "General civic facility repairs, building maintenance, and public asset upkeep");
          stmt.finalize();
        }
        resolve();
      });

    });
  });
}

// Universal query runner wrapper
async function query(sql, params = []) {
  if (useSqlite) {
    return new Promise((resolve, reject) => {
      const isSelect = sql.trim().toUpperCase().startsWith('SELECT');
      if (isSelect) {
        sqliteDb.all(sql, params, (err, rows) => {
          if (err) return reject(err);
          resolve({ rows });
        });
      } else {
        sqliteDb.run(sql, params, function (err) {
          if (err) return reject(err);
          resolve({ rows: [{ id: this.lastID }], rowCount: this.changes });
        });
      }
    });
  } else {
    let pgSql = sql;
    let paramIndex = 1;
    pgSql = pgSql.replace(/\?/g, () => `$${paramIndex++}`);

    const trimmed = pgSql.trim();
    if (trimmed.toUpperCase().startsWith('INSERT') && !trimmed.toUpperCase().includes('RETURNING')) {
      pgSql += ' RETURNING id';
    }

    return pgPool.query(pgSql, params);
  }
}

module.exports = {
  initDatabase,
  query,
  getIsSqlite: () => useSqlite
};
