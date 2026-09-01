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

const seedDefaultUsers = require('../scripts/seedDefaultUsers');
const seedServiceStaff = require('../scripts/seedServiceStaff');
const seed7DemoDepartmentHeads = require('../scripts/seedDemoDepartmentHeads');

function initDatabase() {
  return new Promise((resolve) => {
    const isProduction = process.env.NODE_ENV === 'production';
    const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.SUPABASE_DB_URL || process.env.POSTGRES_URL_NON_POOLING;
    const isPostgres = (DB_TYPE === 'postgres' || isProduction) && Boolean(dbUrl);

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

    if (isPostgres && dbUrl) {
      console.log('Connecting to PostgreSQL database...');
      try {
        pgPool = new Pool({
          connectionString: dbUrl,
          ssl: { rejectUnauthorized: false },
          connectionTimeoutMillis: 3000
        });
        pgPool.query('SELECT NOW()', (err, res) => {
          if (err) {
            console.warn('[DATABASE NOTE] PostgreSQL connection check failed (activating fallback):', err.message);
            setupSqlite(onInitDone, onInitDone);
          } else {
            console.log('PostgreSQL connected successfully.');
            createTablesPostgres().then(onInitDone).catch(e => {
              console.warn('[DATABASE TABLE INIT NOTE]', e.message);
              setupSqlite(onInitDone, onInitDone);
            });
          }
        });
      } catch (e) {
        console.warn('[DATABASE POOL INIT NOTE]', e.message);
        setupSqlite(onInitDone, onInitDone);
      }
    } else {
      console.log('Initializing local/serverless development SQLite/Mem database...');
      setupSqlite(onInitDone, onInitDone);
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

    const safeAddPgCol = async (colDef) => {
      try { await pgPool.query(`ALTER TABLE complaints ADD COLUMN IF NOT EXISTS ${colDef};`); } catch (e) {}
    };
    await safeAddPgCol('assigned_staff_id TEXT');
    await safeAddPgCol('assigned_staff_name TEXT');
    await safeAddPgCol('assigned_staff_email TEXT');
    await safeAddPgCol('assigned_by INTEGER');
    await safeAddPgCol('assigned_by_name TEXT');
    await safeAddPgCol('sla_deadline TIMESTAMP');
    await safeAddPgCol('location_address TEXT');
    await safeAddPgCol('complaint_number TEXT');

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
  const isVercel = Boolean(process.env.VERCEL || process.env.NOW_REGION);
  const sqliteMod = isVercel ? null : getSqlite3();
  if (!sqliteMod || isVercel) {
    console.warn('[STORAGE NOTE] Serverless environment detected. Using fast resilient memory store.');
    return resolve ? resolve() : null;
  }
  const dbPath = path.join(__dirname, '../../nagarsetu.sqlite');
  try {
    sqliteDb = new sqliteMod.Database(dbPath, (err) => {
      if (err) {
        console.warn('Error connecting to SQLite DB, using in-memory store:', err.message);
        sqliteDb = null;
        return resolve ? resolve() : null;
      }
      console.log('Using SQLite database at:', dbPath);
      createTablesSqlite().then(resolve).catch(() => resolve());
    });
  } catch (err) {
    console.warn('SQLite init exception, using in-memory store:', err.message);
    sqliteDb = null;
    return resolve ? resolve() : null;
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

      // Safe column additions for existing databases
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

      // Seed initial default departments if empty
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

const memStore = {
  departments: [
    { id: 1, name: 'Public Works Department (PWD)', description: 'Road repairs, potholes, and asphalt infrastructure' },
    { id: 2, name: 'Sanitation & Waste Management', description: 'Garbage pickup, trash overflow, and public cleanliness' },
    { id: 3, name: 'Water Supply & Sewerage Board', description: 'Pipeline leakages, drainage overflows, and water supply' },
    { id: 4, name: 'Drainage & Sewage Department', description: 'Drainage blockage, sewage overflow, open drains, and culverts' },
    { id: 5, name: 'Electrical & Street Lighting', description: 'Streetlight repair, electrical poles, and public lighting' },
    { id: 6, name: 'Traffic Management Department', description: 'Traffic signal repairs, road signage, and junction issues' },
    { id: 7, name: 'Maintenance Department', description: 'General civic facility repairs, building maintenance, and public asset upkeep' }
  ],
  users: [],
  department_heads: [],
  field_staff: [],
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

  let targetTable = null;
  for (const table of Object.keys(memStore)) {
    if (upper.includes(`FROM ${table.toUpperCase()}`) || upper.includes(`INTO ${table.toUpperCase()}`) || upper.includes(`UPDATE ${table.toUpperCase()}`)) {
      targetTable = table;
      break;
    }
  }

  if (!targetTable) {
    targetTable = 'users';
  }

  if (upper.startsWith('SELECT COUNT')) {
    const list = memStore[targetTable] || [];
    return Promise.resolve({ rows: [{ count: list.length }] });
  }

  if (upper.startsWith('SELECT')) {
    let list = memStore[targetTable] || [];
    if (params && params.length > 0) {
      const pStr = params.map(p => String(p).trim().toLowerCase().replace(/^%|%$/g, ''));
      const isDeptQuery = upper.includes('WHERE DEPARTMENT_ID') || upper.includes('WHERE C.DEPARTMENT_ID') || upper.includes('WHERE FS.DEPARTMENT_ID') || upper.includes('AND C.DEPARTMENT_ID') || upper.includes('AND (C.DEPARTMENT_ID');
      const isCitizenQuery = upper.includes('WHERE CITIZEN_ID') || upper.includes('WHERE C.CITIZEN_ID') || upper.includes('AND C.CITIZEN_ID');
      const isIdQuery = upper.includes('WHERE C.ID =') || upper.includes('WHERE ID =') || upper.includes('WHERE CAST(C.ID AS TEXT) = $1');

      const filtered = list.filter(item => {
        if (!item) return false;
        const itemMobile = item.mobile ? String(item.mobile).trim().toLowerCase() : '';
        const itemEmail = item.email ? String(item.email).trim().toLowerCase() : '';
        const itemId = item.id !== undefined ? String(item.id).trim() : '';
        const itemUserId = item.user_id !== undefined ? String(item.user_id).trim() : '';
        const itemCitizenId = item.citizen_id !== undefined ? String(item.citizen_id).trim() : '';
        const itemDeptId = item.department_id !== undefined ? String(item.department_id).trim() : '';
        const itemStatus = item.status ? String(item.status).trim().toLowerCase() : '';
        const itemName = item.name ? String(item.name).trim().toLowerCase() : '';
        const itemEmpId = item.employee_id ? String(item.employee_id).trim().toLowerCase() : '';
        const itemNumber = item.complaint_number ? String(item.complaint_number).trim().toLowerCase() : '';

        if (isDeptQuery) {
          return pStr.some(p => p !== '' && itemDeptId === p);
        }
        if (isCitizenQuery) {
          return pStr.some(p => p !== '' && itemCitizenId === p);
        }
        if (isIdQuery) {
          return pStr.some(p => p !== '' && (itemId === p || itemNumber === p));
        }

        return pStr.some(p => p !== '' && (
          itemMobile === p || 
          itemEmail === p || 
          itemId === p || 
          itemUserId === p ||
          itemCitizenId === p ||
          itemDeptId === p ||
          itemStatus === p ||
          itemEmpId === p ||
          itemNumber === p ||
          (p.length >= 2 && (itemName.includes(p) || itemEmail.includes(p) || itemMobile.includes(p)))
        ));
      });
      return Promise.resolve({ rows: filtered });
    }
    return Promise.resolve({ rows: list });
  }

  if (upper.startsWith('INSERT')) {
    const newId = (memStore[targetTable] ? memStore[targetTable].length : 0) + 1;
    const newObj = { id: newId, status: 'active', created_at: new Date().toISOString() };
    
    const colMatch = s.match(/INSERT\s+INTO\s+\w+\s*\(([^)]+)\)/i);
    if (colMatch && colMatch[1]) {
      const cols = colMatch[1].split(',').map(c => c.trim().toLowerCase());
      cols.forEach((col, idx) => {
        if (params[idx] !== undefined) {
          newObj[col] = params[idx];
        }
      });
    }
    
    if (!memStore[targetTable]) memStore[targetTable] = [];
    memStore[targetTable].push(newObj);
    return Promise.resolve({ rows: [{ id: newId }], rowCount: 1 });
  }

  if (upper.startsWith('UPDATE')) {
    const list = memStore[targetTable] || [];
    const setMatch = s.match(/UPDATE\s+\w+\s+SET\s+(.+?)\s+WHERE/i);
    if (setMatch && setMatch[1] && params.length > 0) {
      const setPairs = setMatch[1].split(',').map(p => p.trim());
      const whereVal = params[params.length - 1];
      const target = list.find(item => item && (String(item.id) === String(whereVal) || String(item.mobile) === String(whereVal) || String(item.complaint_number) === String(whereVal)));
      if (target) {
        setPairs.forEach((pair) => {
          const parts = pair.split('=');
          const colName = parts[0].trim().toLowerCase();
          const valExpr = parts[1] ? parts[1].trim() : '';
          const pMatch = valExpr.match(/\$(\d+)/);
          if (pMatch) {
            const pIdx = parseInt(pMatch[1], 10) - 1;
            if (params[pIdx] !== undefined) {
              target[colName] = params[pIdx];
            }
          } else if (valExpr.toUpperCase().includes('CURRENT_TIMESTAMP') || valExpr.toUpperCase().includes('NOW()')) {
            target[colName] = new Date().toISOString();
          } else if (valExpr.startsWith("'") || valExpr.startsWith('"')) {
            target[colName] = valExpr.slice(1, -1);
          }
        });
      }
    }
    return Promise.resolve({ rows: [], rowCount: 1 });
  }

  return Promise.resolve({ rows: memStore[targetTable] || [], rowCount: 1 });
}

// Universal query runner wrapper
async function query(sql, params = []) {
  if (useSqlite) {
    if (!sqliteDb) {
      return runMemQuery(sql, params);
    }
    return new Promise((resolve, reject) => {
      let sqliteSql = sql;
      let sqliteParams = [];
      if (/\$\d+/.test(sql)) {
        sqliteParams = [];
        sqliteSql = sql.replace(/\$(\d+)/g, (_, num) => {
          const idx = parseInt(num, 10) - 1;
          sqliteParams.push(params[idx]);
          return '?';
        });
      } else {
        sqliteParams = params;
      }
      const isSelect = sqliteSql.trim().toUpperCase().startsWith('SELECT');
      if (isSelect) {
        sqliteDb.all(sqliteSql, sqliteParams, (err, rows) => {
          if (err) return reject(err);
          resolve({ rows });
        });
      } else {
        sqliteDb.run(sqliteSql, sqliteParams, function (err) {
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
