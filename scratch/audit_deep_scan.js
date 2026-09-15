const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');

// 1. Scan Routes
const routesDir = path.join(projectRoot, 'backend', 'src', 'routes');
const routeFiles = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));

const allRoutes = [];

routeFiles.forEach(file => {
  const filePath = path.join(routesDir, file);
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  lines.forEach((line, i) => {
    const match = line.match(/router\.(get|post|put|patch|delete)\s*\(\s*([^,]+)/);
    if (match) {
      const method = match[1].toUpperCase();
      let routePath = match[2].trim().replace(/['"`]/g, '');
      
      // Check auth middleware
      const hasAuth = line.includes('authenticateToken');
      const hasRole = line.includes('requireRole');
      let roles = 'Any';
      if (hasRole) {
        const rMatch = line.match(/requireRole\s*\(\s*\[(.*?)\]\s*\)/);
        if (rMatch) roles = rMatch[1].replace(/['"\s]/g, '');
      }

      allRoutes.push({
        file,
        line: i + 1,
        method,
        path: routePath,
        auth: hasAuth,
        roles,
        fullLine: line.trim()
      });
    }
  });
});

console.log('=== ROUTE ANALYSIS ===');
console.log(`Total backend routes found: ${allRoutes.length}`);

// Detect duplicates/collisions
const pathMap = {};
allRoutes.forEach(r => {
  const key = `${r.method} ${r.path}`;
  if (!pathMap[key]) pathMap[key] = [];
  pathMap[key].push(r);
});

console.log('\n--- Duplicate Route Registrations ---');
Object.keys(pathMap).forEach(k => {
  if (pathMap[k].length > 1) {
    console.log(`\nDUPLICATE ROUTE: ${k}`);
    pathMap[k].forEach(item => {
      console.log(`  - File: ${item.file}:${item.line} (Auth: ${item.auth}, Roles: ${item.roles})`);
    });
  }
});

// 2. Scan Frontend API calls vs Backend Endpoints
const frontendDir = path.join(projectRoot, 'frontend', 'src');

function findCalls(dir) {
  let calls = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });
  items.forEach(item => {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) {
      calls = calls.concat(findCalls(full));
    } else if (item.name.endsWith('.ts') || item.name.endsWith('.tsx') || item.name.endsWith('.js')) {
      const content = fs.readFileSync(full, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        // match fetch or axios or supabase
        if (line.includes('/api/') || line.includes('supabase.from') || line.includes('supabase.rpc')) {
          calls.push({
            file: path.relative(projectRoot, full),
            line: idx + 1,
            code: line.trim()
          });
        }
      });
    }
  });
  return calls;
}

const fCalls = findCalls(frontendDir);
console.log(`\nTotal frontend API/Supabase calls scanned: ${fCalls.length}`);

// 3. Scan Hardcoded Values
console.log('\n=== HARDCODED VALUE SCAN ===');
const hardcodedPatterns = [
  'nagarsetu@123',
  'password123',
  'Pratik',
  'Demo Citizen',
  'STF-001',
  'EMP-PWD-001',
  'http://localhost:5000'
];

hardcodedPatterns.forEach(pattern => {
  let count = 0;
  function scanHardcoded(dir) {
    const items = fs.readdirSync(dir, { withFileTypes: true });
    items.forEach(item => {
      if (item.name === 'node_modules' || item.name === '.git' || item.name === 'dist') return;
      const full = path.join(dir, item.name);
      if (item.isDirectory()) {
        scanHardcoded(full);
      } else if (item.name.endsWith('.ts') || item.name.endsWith('.tsx') || item.name.endsWith('.js') || item.name.endsWith('.json')) {
        const content = fs.readFileSync(full, 'utf8');
        if (content.includes(pattern)) {
          count++;
        }
      }
    });
  }
  scanHardcoded(path.join(projectRoot, 'backend'));
  scanHardcoded(path.join(projectRoot, 'frontend'));
  console.log(`Pattern "${pattern}": found in ${count} files.`);
});

