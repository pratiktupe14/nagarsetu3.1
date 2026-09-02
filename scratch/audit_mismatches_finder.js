const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const frontendDir = path.join(rootDir, 'frontend', 'src');
const backendDir = path.join(rootDir, 'backend', 'src');

function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);
  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
    } else {
      arrayOfFiles.push(fullPath);
    }
  });
  return arrayOfFiles;
}

// Read database config to inspect table definitions
const dbJs = fs.readFileSync(path.join(backendDir, 'config', 'db.js'), 'utf8');

// Parse CREATE TABLE statements in db.js
const tableRegex = /CREATE TABLE IF NOT EXISTS\s+([a-zA-Z0-9_]+)\s*\(([\s\S]*?)\);/gi;
const dbTables = {};
let tableMatch;
while ((tableMatch = tableRegex.exec(dbJs)) !== null) {
  const tableName = tableMatch[1];
  const columnsRaw = tableMatch[2];
  const colLines = columnsRaw.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('--') && !l.startsWith('PRIMARY KEY') && !l.startsWith('FOREIGN KEY') && !l.startsWith('UNIQUE'));
  const columns = colLines.map(l => l.split(/\s+/)[0]).filter(Boolean);
  dbTables[tableName] = columns;
}

console.log('=== DATABASE TABLES INVENTORIED ===');
console.log(Object.keys(dbTables));

// Read Types from frontend/src/types/database.types.ts
const typesFile = path.join(frontendDir, 'types', 'database.types.ts');
let tsTypes = '';
if (fs.existsSync(typesFile)) {
  tsTypes = fs.readFileSync(typesFile, 'utf8');
}

console.log('\n=== CHECKING FRONTEND TS TYPES VS DATABASE COLUMNS ===');
for (const [table, cols] of Object.entries(dbTables)) {
  console.log(`Table: ${table} (${cols.length} columns)`);
}

console.log('\n=== SCANNING ALL FRONTEND SERVICES FOR API REQUEST/RESPONSE PATTERNS ===');
const serviceFiles = getAllFiles(path.join(frontendDir, 'services'));

serviceFiles.forEach(sf => {
  const content = fs.readFileSync(sf, 'utf8');
  const relPath = path.relative(rootDir, sf);

  // Check fetch calls
  const lines = content.split('\n');
  lines.forEach((l, idx) => {
    if (l.includes('fetch(') || l.includes('axios(') || l.includes('apiClient(')) {
      // print API call context
      const snippet = lines.slice(Math.max(0, idx - 2), Math.min(lines.length, idx + 5)).join('\n');
    }
  });
});
