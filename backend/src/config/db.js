const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

let sqlite3 = null;
function getSqlite3() {
  if (!sqlite3) {
    try {
      sqlite3 = require('sqlite3').verbose();
    } catch (e) {
      console.warn('[SQLITE NOTE] sqlite3 native module not loaded:', e.message);
    }
  }
  return sqlite3;
}

let pgPool = null;
let sqliteDb = null;
let useSqlite = false;

const DB_TYPE = process.env.DB_TYPE || 'sqlite'; // 'postgres' or 'sqlite'

function initDatabase() {
  return new Promise((resolve) => {
    const isProduction = process.env.NODE_ENV === 'production';
    const isPostgres = DB_TYPE === 'postgres' || isProduction;

    const dbUrl = process.env.DATABASE_URL;

    if (isPostgres && dbUrl) {
      console.log('Connecting to PostgreSQL database...');
      try {
        pgPool = new Pool({
          connectionString: dbUrl,
          ssl: { rejectUnauthorized: false }
        });
        pgPool.query('SELECT NOW()', (err, res) => {
          if (err) {
            console.warn('[DATABASE NOTE] PostgreSQL connection check failed (activating fallback SQLite):', err.message);
            setupSqlite(resolve, resolve);
          } else {
            console.log('PostgreSQL connected successfully.');
            createTablesPostgres().then(resolve).catch(e => {
              console.warn('[DATABASE TABLE INIT NOTE]', e.message);
              setupSqlite(resolve, resolve);
            });
          }
        });
      } catch (e) {
        console.warn('[DATABASE POOL INIT NOTE]', e.message);
        setupSqlite(resolve, resolve);
      }
    } else {
      console.log('Initializing local development SQLite database...');
      setupSqlite(resolve, resolve);
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
        complaint_number TEXT,
        citizen_id TEXT,
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

    // Safe column migrations for existing Postgres database
    await pgPool.query(`ALTER TABLE complaints DROP CONSTRAINT IF EXISTS complaints_citizen_id_fkey;`).catch(() => {});
    await pgPool.query(`ALTER TABLE complaints ALTER COLUMN citizen_id TYPE TEXT;`).catch(() => {});

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
        user_id TEXT,
        complaint_id INTEGER REFERENCES complaints(id),
        channel TEXT DEFAULT 'in_app',
        message TEXT NOT NULL,
        is_read INTEGER DEFAULT 0,
        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pgPool.query(`ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;`).catch(() => {});
    await pgPool.query(`ALTER TABLE notifications ALTER COLUMN user_id TYPE TEXT;`).catch(() => {});

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

    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS announcement_reads (
        id SERIAL PRIMARY KEY,
        announcement_id INTEGER REFERENCES announcements(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL,
        read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(announcement_id, user_id)
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
  const sqliteMod = getSqlite3();
  if (!sqliteMod) {
    console.warn('[SQLITE NOTE] Cannot initialize SQLite without native module.');
    return resolve ? resolve() : null;
  }
  const isVercel = process.env.VERCEL || process.env.NODE_ENV === 'production';
  const dbPath = isVercel ? path.join('/tmp', 'nagarsetu.sqlite') : path.join(__dirname, '../../nagarsetu.sqlite');
  sqliteDb = new sqliteMod.Database(dbPath, (err) => {
    if (err) {
      console.error('Error connecting to SQLite DB:', err);
      return reject ? reject(err) : null;
    }
    console.log('Using SQLite database at:', dbPath);
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
      safeAddColumn('users', 'designation TEXT DEFAULT "Field Service Staff"');
      safeAddColumn('users', 'status TEXT DEFAULT "active"');
      safeAddColumn('complaints', 'location_address TEXT');
      safeAddColumn('complaints', 'complaint_number TEXT');

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

      // Safe column additions for SQLite migrations
      const safeAddSqliteColumn = (table, colDef) => {
        sqliteDb.run(`ALTER TABLE ${table} ADD COLUMN ${colDef}`, () => {});
      };
      safeAddSqliteColumn('users', "designation TEXT DEFAULT 'Field Service Staff'");
      safeAddSqliteColumn('announcements', "status TEXT DEFAULT 'Published'");
      safeAddSqliteColumn('announcements', "target_audience TEXT DEFAULT 'all_departments'");
      safeAddSqliteColumn('announcements', 'target_role TEXT');
      safeAddSqliteColumn('announcements', "created_by_role TEXT DEFAULT 'city_admin'");
      safeAddSqliteColumn('announcements', 'expires_at DATETIME');

      safeAddSqliteColumn('complaints', 'assigned_staff_id TEXT');
      safeAddSqliteColumn('complaints', 'assigned_staff_name TEXT');
      safeAddSqliteColumn('complaints', 'assigned_staff_email TEXT');
      safeAddSqliteColumn('complaints', 'sla_deadline DATETIME');

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

const memStore = {
  departments: [
    { id: 1, name: 'Public Works Department (PWD)', code: 'PWD', description: 'Road repairs, potholes, and asphalt infrastructure' },
    { id: 2, name: 'Sanitation & Waste Management', code: 'SAN', description: 'Garbage pickup, trash overflow, and public cleanliness' },
    { id: 3, name: 'Water Supply & Sewerage Board', code: 'WTR', description: 'Pipeline leakages, drainage overflows, and water supply' },
    { id: 4, name: 'Drainage & Sewage Department', code: 'DRN', description: 'Drainage blockage, sewage overflow, open drains, and culverts' },
    { id: 5, name: 'Electrical & Street Lighting', code: 'ELE', description: 'Streetlight repair, electrical poles, and public lighting' },
    { id: 6, name: 'Traffic Management Department', code: 'TRF', description: 'Traffic signal repairs, road signage, and junction issues' },
    { id: 7, name: 'Maintenance Department', code: 'MNT', description: 'General civic facility repairs, building maintenance, and public asset upkeep' }
  ],
  department_heads: [
    { id: 1, department_id: 1, name: 'Rahul Kumar', email: 'rahul.kumar@nagarsetu.gov.in', phone: '+91 9822000001', employee_id: 'EMP-PWD-001', designation: 'Department Head', status: 'active', department_name: 'Public Works Department (PWD)' },
    { id: 2, department_id: 2, name: 'Amit Sharma', email: 'amit.sharma@nagarsetu.gov.in', phone: '+91 9822000002', employee_id: 'EMP-SAN-001', designation: 'Department Head', status: 'active', department_name: 'Sanitation & Waste Management' },
    { id: 3, department_id: 3, name: 'Vikram Patil', email: 'vikram.patil@nagarsetu.gov.in', phone: '+91 9822000003', employee_id: 'EMP-WTR-001', designation: 'Department Head', status: 'active', department_name: 'Water Supply & Sewerage Board' },
    { id: 4, department_id: 4, name: 'Sanjay More', email: 'sanjay.more@nagarsetu.gov.in', phone: '+91 9822000004', employee_id: 'EMP-DRN-001', designation: 'Department Head', status: 'active', department_name: 'Drainage & Sewage Department' },
    { id: 5, department_id: 5, name: 'Aditya Joshi', email: 'aditya.joshi@nagarsetu.gov.in', phone: '+91 9822000005', employee_id: 'EMP-ELE-001', designation: 'Department Head', status: 'active', department_name: 'Electrical & Street Lighting' },
    { id: 6, department_id: 6, name: 'Rohan Deshmukh', email: 'rohan.deshmukh@nagarsetu.gov.in', phone: '+91 9822000006', employee_id: 'EMP-TRF-001', designation: 'Department Head', status: 'active', department_name: 'Traffic Management Department' },
    { id: 7, department_id: 7, name: 'Kunal Kulkarni', email: 'kunal.kulkarni@nagarsetu.gov.in', phone: '+91 9822000007', employee_id: 'EMP-MNT-001', designation: 'Department Head', status: 'active', department_name: 'Maintenance Department' }
  ],
  users: [
    { id: 1, name: 'Municipal Admin', employee_id: 'ADM-001', email: 'admin@nagarsetu.gov.in', mobile: '9876543213', role: 'city_admin', department_id: null, department_name: 'City Administration', designation: 'City Administrator', status: 'active', active_tasks: 0, completed_tasks: 0, overdue_tasks: 0 },
    { id: 101, name: 'Amit Patil', employee_id: 'PWD-STF-001', email: 'amit.patil@nagarsetu.gov.in', mobile: '9822010001', role: 'service_staff', department_id: 1, department_name: 'Public Works Department (PWD)', designation: 'Field Service Staff', status: 'active', active_tasks: 0, completed_tasks: 0, overdue_tasks: 0 },
    { id: 102, name: 'Sagar Jadhav', employee_id: 'PWD-STF-002', email: 'sagar.jadhav@nagarsetu.gov.in', mobile: '9822010002', role: 'service_staff', department_id: 1, department_name: 'Public Works Department (PWD)', designation: 'Field Service Staff', status: 'active', active_tasks: 0, completed_tasks: 0, overdue_tasks: 0 },
    { id: 103, name: 'Nikhil Shinde', employee_id: 'PWD-STF-003', email: 'nikhil.shinde@nagarsetu.gov.in', mobile: '9822010003', role: 'service_staff', department_id: 1, department_name: 'Public Works Department (PWD)', designation: 'Field Service Staff', status: 'active', active_tasks: 0, completed_tasks: 0, overdue_tasks: 0 },
    { id: 104, name: 'Rohit More', employee_id: 'PWD-STF-004', email: 'rohit.more@nagarsetu.gov.in', mobile: '9822010004', role: 'service_staff', department_id: 1, department_name: 'Public Works Department (PWD)', designation: 'Field Service Staff', status: 'active', active_tasks: 0, completed_tasks: 0, overdue_tasks: 0 },
    { id: 105, name: 'Akash Pawar', employee_id: 'PWD-STF-005', email: 'akash.pawar@nagarsetu.gov.in', mobile: '9822010005', role: 'service_staff', department_id: 1, department_name: 'Public Works Department (PWD)', designation: 'Field Service Staff', status: 'active', active_tasks: 0, completed_tasks: 0, overdue_tasks: 0 },

    { id: 106, name: 'Prashant Mane', employee_id: 'SAN-STF-001', email: 'prashant.mane@nagarsetu.gov.in', mobile: '9822010006', role: 'service_staff', department_id: 2, department_name: 'Sanitation & Waste Management', designation: 'Field Service Staff', status: 'active', active_tasks: 0, completed_tasks: 0, overdue_tasks: 0 },
    { id: 107, name: 'Ganesh Chavan', employee_id: 'SAN-STF-002', email: 'ganesh.chavan@nagarsetu.gov.in', mobile: '9822010007', role: 'service_staff', department_id: 2, department_name: 'Sanitation & Waste Management', designation: 'Field Service Staff', status: 'active', active_tasks: 0, completed_tasks: 0, overdue_tasks: 0 },
    { id: 108, name: 'Mahesh Kadam', employee_id: 'SAN-STF-003', email: 'mahesh.kadam@nagarsetu.gov.in', mobile: '9822010008', role: 'service_staff', department_id: 2, department_name: 'Sanitation & Waste Management', designation: 'Field Service Staff', status: 'active', active_tasks: 0, completed_tasks: 0, overdue_tasks: 0 },
    { id: 109, name: 'Swapnil Bhosale', employee_id: 'SAN-STF-004', email: 'swapnil.bhosale@nagarsetu.gov.in', mobile: '9822010009', role: 'service_staff', department_id: 2, department_name: 'Sanitation & Waste Management', designation: 'Field Service Staff', status: 'active', active_tasks: 0, completed_tasks: 0, overdue_tasks: 0 },
    { id: 110, name: 'Deepak Wagh', employee_id: 'SAN-STF-005', email: 'deepak.wagh@nagarsetu.gov.in', mobile: '9822010010', role: 'service_staff', department_id: 2, department_name: 'Sanitation & Waste Management', designation: 'Field Service Staff', status: 'active', active_tasks: 0, completed_tasks: 0, overdue_tasks: 0 },

    { id: 111, name: 'Kiran Patil', employee_id: 'WTR-STF-001', email: 'kiran.patil@nagarsetu.gov.in', mobile: '9822010011', role: 'service_staff', department_id: 3, department_name: 'Water Supply & Sewerage Board', designation: 'Field Service Staff', status: 'active', active_tasks: 0, completed_tasks: 0, overdue_tasks: 0 },
    { id: 112, name: 'Manoj Shinde', employee_id: 'WTR-STF-002', email: 'manoj.shinde@nagarsetu.gov.in', mobile: '9822010012', role: 'service_staff', department_id: 3, department_name: 'Water Supply & Sewerage Board', designation: 'Field Service Staff', status: 'active', active_tasks: 0, completed_tasks: 0, overdue_tasks: 0 },
    { id: 113, name: 'Sachin More', employee_id: 'WTR-STF-003', email: 'sachin.more@nagarsetu.gov.in', mobile: '9822010013', role: 'service_staff', department_id: 3, department_name: 'Water Supply & Sewerage Board', designation: 'Field Service Staff', status: 'active', active_tasks: 0, completed_tasks: 0, overdue_tasks: 0 },
    { id: 114, name: 'Ajay Jadhav', employee_id: 'WTR-STF-004', email: 'ajay.jadhav@nagarsetu.gov.in', mobile: '9822010014', role: 'service_staff', department_id: 3, department_name: 'Water Supply & Sewerage Board', designation: 'Field Service Staff', status: 'active', active_tasks: 0, completed_tasks: 0, overdue_tasks: 0 },
    { id: 115, name: 'Vivek Pawar', employee_id: 'WTR-STF-005', email: 'vivek.pawar@nagarsetu.gov.in', mobile: '9822010015', role: 'service_staff', department_id: 3, department_name: 'Water Supply & Sewerage Board', designation: 'Field Service Staff', status: 'active', active_tasks: 0, completed_tasks: 0, overdue_tasks: 0 },

    { id: 116, name: 'Sunil Patil', employee_id: 'DRN-STF-001', email: 'sunil.patil@nagarsetu.gov.in', mobile: '9822010016', role: 'service_staff', department_id: 4, department_name: 'Drainage & Sewage Department', designation: 'Field Service Staff', status: 'active', active_tasks: 0, completed_tasks: 0, overdue_tasks: 0 },
    { id: 117, name: 'Ramesh More', employee_id: 'DRN-STF-002', email: 'ramesh.more@nagarsetu.gov.in', mobile: '9822010017', role: 'service_staff', department_id: 4, department_name: 'Drainage & Sewage Department', designation: 'Field Service Staff', status: 'active', active_tasks: 0, completed_tasks: 0, overdue_tasks: 0 },
    { id: 118, name: 'Santosh Jadhav', employee_id: 'DRN-STF-003', email: 'santosh.jadhav@nagarsetu.gov.in', mobile: '9822010018', role: 'service_staff', department_id: 4, department_name: 'Drainage & Sewage Department', designation: 'Field Service Staff', status: 'active', active_tasks: 0, completed_tasks: 0, overdue_tasks: 0 },
    { id: 119, name: 'Dinesh Shinde', employee_id: 'DRN-STF-004', email: 'dinesh.shinde@nagarsetu.gov.in', mobile: '9822010019', role: 'service_staff', department_id: 4, department_name: 'Drainage & Sewage Department', designation: 'Field Service Staff', status: 'active', active_tasks: 0, completed_tasks: 0, overdue_tasks: 0 },
    { id: 120, name: 'Pravin Pawar', employee_id: 'DRN-STF-005', email: 'pravin.pawar@nagarsetu.gov.in', mobile: '9822010020', role: 'service_staff', department_id: 4, department_name: 'Drainage & Sewage Department', designation: 'Field Service Staff', status: 'active', active_tasks: 0, completed_tasks: 0, overdue_tasks: 0 },

    { id: 121, name: 'Rahul Joshi', employee_id: 'ELE-STF-001', email: 'rahul.joshi@nagarsetu.gov.in', mobile: '9822010021', role: 'service_staff', department_id: 5, department_name: 'Electrical & Street Lighting', designation: 'Field Service Staff', status: 'active', active_tasks: 0, completed_tasks: 0, overdue_tasks: 0 },
    { id: 122, name: 'Sameer Kulkarni', employee_id: 'ELE-STF-002', email: 'sameer.kulkarni@nagarsetu.gov.in', mobile: '9822010022', role: 'service_staff', department_id: 5, department_name: 'Electrical & Street Lighting', designation: 'Field Service Staff', status: 'active', active_tasks: 0, completed_tasks: 0, overdue_tasks: 0 },
    { id: 123, name: 'Tejas Deshmukh', employee_id: 'ELE-STF-003', email: 'tejas.deshmukh@nagarsetu.gov.in', mobile: '9822010023', role: 'service_staff', department_id: 5, department_name: 'Electrical & Street Lighting', designation: 'Field Service Staff', status: 'active', active_tasks: 0, completed_tasks: 0, overdue_tasks: 0 },
    { id: 124, name: 'Omkar Patil', employee_id: 'ELE-STF-004', email: 'omkar.patil@nagarsetu.gov.in', mobile: '9822010024', role: 'service_staff', department_id: 5, department_name: 'Electrical & Street Lighting', designation: 'Field Service Staff', status: 'active', active_tasks: 0, completed_tasks: 0, overdue_tasks: 0 },
    { id: 125, name: 'Harshad More', employee_id: 'ELE-STF-005', email: 'harshad.more@nagarsetu.gov.in', mobile: '9822010025', role: 'service_staff', department_id: 5, department_name: 'Electrical & Street Lighting', designation: 'Field Service Staff', status: 'active', active_tasks: 0, completed_tasks: 0, overdue_tasks: 0 },

    { id: 126, name: 'Rohan Patil', employee_id: 'TRF-STF-001', email: 'rohan.patil@nagarsetu.gov.in', mobile: '9822010026', role: 'service_staff', department_id: 6, department_name: 'Traffic Management Department', designation: 'Field Service Staff', status: 'active', active_tasks: 0, completed_tasks: 0, overdue_tasks: 0 },
    { id: 127, name: 'Vishal Jadhav', employee_id: 'TRF-STF-002', email: 'vishal.jadhav@nagarsetu.gov.in', mobile: '9822010027', role: 'service_staff', department_id: 6, department_name: 'Traffic Management Department', designation: 'Field Service Staff', status: 'active', active_tasks: 0, completed_tasks: 0, overdue_tasks: 0 },
    { id: 128, name: 'Tushar More', employee_id: 'TRF-STF-003', email: 'tushar.more@nagarsetu.gov.in', mobile: '9822010028', role: 'service_staff', department_id: 6, department_name: 'Traffic Management Department', designation: 'Field Service Staff', status: 'active', active_tasks: 0, completed_tasks: 0, overdue_tasks: 0 },
    { id: 129, name: 'Nitin Shinde', employee_id: 'TRF-STF-004', email: 'nitin.shinde@nagarsetu.gov.in', mobile: '9822010029', role: 'service_staff', department_id: 6, department_name: 'Traffic Management Department', designation: 'Field Service Staff', status: 'active', active_tasks: 0, completed_tasks: 0, overdue_tasks: 0 },
    { id: 130, name: 'Amol Pawar', employee_id: 'TRF-STF-005', email: 'amol.pawar@nagarsetu.gov.in', mobile: '9822010030', role: 'service_staff', department_id: 6, department_name: 'Traffic Management Department', designation: 'Field Service Staff', status: 'active', active_tasks: 0, completed_tasks: 0, overdue_tasks: 0 },

    { id: 131, name: 'Kunal Patil', employee_id: 'MNT-STF-001', email: 'kunal.patil@nagarsetu.gov.in', mobile: '9822010031', role: 'service_staff', department_id: 7, department_name: 'Maintenance Department', designation: 'Field Service Staff', status: 'active', active_tasks: 0, completed_tasks: 0, overdue_tasks: 0 },
    { id: 132, name: 'Ganesh More', employee_id: 'MNT-STF-002', email: 'ganesh.more@nagarsetu.gov.in', mobile: '9822010032', role: 'service_staff', department_id: 7, department_name: 'Maintenance Department', designation: 'Field Service Staff', status: 'active', active_tasks: 0, completed_tasks: 0, overdue_tasks: 0 },
    { id: 133, name: 'Mayur Jadhav', employee_id: 'MNT-STF-003', email: 'mayur.jadhav@nagarsetu.gov.in', mobile: '9822010033', role: 'service_staff', department_id: 7, department_name: 'Maintenance Department', designation: 'Field Service Staff', status: 'active', active_tasks: 0, completed_tasks: 0, overdue_tasks: 0 },
    { id: 134, name: 'Sachin Pawar', employee_id: 'MNT-STF-004', email: 'sachin.pawar@nagarsetu.gov.in', mobile: '9822010034', role: 'service_staff', department_id: 7, department_name: 'Maintenance Department', designation: 'Field Service Staff', status: 'active', active_tasks: 0, completed_tasks: 0, overdue_tasks: 0 },
    { id: 135, name: 'Yogesh Shinde', employee_id: 'MNT-STF-005', email: 'yogesh.shinde@nagarsetu.gov.in', mobile: '9822010035', role: 'service_staff', department_id: 7, department_name: 'Maintenance Department', designation: 'Field Service Staff', status: 'active', active_tasks: 0, completed_tasks: 0, overdue_tasks: 0 },
    { id: 136, name: 'Ramesh Kumar (Field Staff)', employee_id: 'STF-GEN-001', email: 'staff@nagarsetu.gov.in', mobile: '9876543212', role: 'service_staff', department_id: 1, department_name: 'Public Works Department (PWD)', designation: 'Field Service Staff', status: 'active', active_tasks: 0, completed_tasks: 0, overdue_tasks: 0 }
  ],
  complaints: [],
  assignments: [],
  feedback: [],
  notifications: [],
  complaint_status_history: [],
  announcements: [],
  announcement_reads: []
};

function runMemQuery(sql, params = []) {
  const s = sql.trim();
  const upper = s.toUpperCase();

  if (upper.includes('FROM DEPARTMENTS') || upper.includes('INTO DEPARTMENTS')) {
    if (upper.startsWith('SELECT COUNT')) {
      return Promise.resolve({ rows: [{ count: memStore.departments.length }] });
    }
    return Promise.resolve({ rows: memStore.departments });
  }

  if (upper.startsWith('SELECT COUNT')) {
    for (const table of Object.keys(memStore)) {
      if (upper.includes(`FROM ${table.toUpperCase()}`)) {
        return Promise.resolve({ rows: [{ count: memStore[table].length }] });
      }
    }
    return Promise.resolve({ rows: [{ count: 0 }] });
  }

  if (upper.startsWith('SELECT')) {
    for (const table of Object.keys(memStore)) {
      if (upper.includes(`FROM ${table.toUpperCase()}`)) {
        return Promise.resolve({ rows: memStore[table] });
      }
    }
    return Promise.resolve({ rows: [] });
  }

  if (upper.startsWith('INSERT')) {
    for (const table of Object.keys(memStore)) {
      if (upper.includes(`INTO ${table.toUpperCase()}`)) {
        const newId = memStore[table].length + 1;
        const newObj = { id: newId, created_at: new Date().toISOString() };
        memStore[table].push(newObj);
        return Promise.resolve({ rows: [{ id: newId }], rowCount: 1 });
      }
    }
    return Promise.resolve({ rows: [{ id: 1 }], rowCount: 1 });
  }

  return Promise.resolve({ rows: [], rowCount: 1 });
}

// Universal query runner wrapper
async function query(sql, params = []) {
  if (useSqlite) {
    if (!sqliteDb) {
      return runMemQuery(sql, params);
    }
    return new Promise((resolve, reject) => {
      let finalParams = params;
      let sqliteSql = sql;
      if (Array.isArray(params) && params.length > 0 && /\$\d+/.test(sql)) {
        const sqliteParams = [];
        sqliteSql = sql.replace(/\$(\d+)/g, (_, num) => {
          const index = parseInt(num, 10) - 1;
          sqliteParams.push(params[index]);
          return '?';
        });
        finalParams = sqliteParams;
      } else {
        sqliteSql = sql.replace(/\$\d+/g, '?');
      }
      const isSelect = sqliteSql.trim().toUpperCase().startsWith('SELECT');
      if (isSelect) {
        sqliteDb.all(sqliteSql, finalParams, (err, rows) => {
          if (err) return reject(err);
          resolve({ rows });
        });
      } else {
        sqliteDb.run(sqliteSql, finalParams, function (err) {
          if (err) return reject(err);
          resolve({ rows: [{ id: this.lastID }], rowCount: this.changes });
        });
      }
    });
  } else {
    try {
      let pgSql = sql;
      let paramIndex = 1;
      pgSql = pgSql.replace(/\?/g, () => `$${paramIndex++}`);

      const trimmed = pgSql.trim();
      if (trimmed.toUpperCase().startsWith('INSERT') && !trimmed.toUpperCase().includes('RETURNING')) {
        pgSql += ' RETURNING id';
      }

      return await pgPool.query(pgSql, params);
    } catch (err) {
      console.warn('[DATABASE QUERY WARN] PostgreSQL query failed, activating SQLite/Mem fallback:', err.message);
      if (!sqliteDb) {
        await new Promise(r => setupSqlite(r, r));
      }
      useSqlite = true;
      return query(sql, params);
    }
  }
}

module.exports = {
  initDatabase,
  query,
  getIsSqlite: () => useSqlite
};
