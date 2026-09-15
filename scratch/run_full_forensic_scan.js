const fs = require('fs');
const path = require('path');

const BACKEND_ROUTES_DIR = path.join(__dirname, '..', 'backend', 'src', 'routes');
const FRONTEND_SRC_DIR = path.join(__dirname, '..', 'frontend', 'src');

console.log('==================================================');
console.log('BACKEND ROUTES SCAN');
console.log('==================================================');

const routeFiles = fs.readdirSync(BACKEND_ROUTES_DIR).filter(f => f.endsWith('.js'));
const routes = [];

routeFiles.forEach(file => {
  const content = fs.readFileSync(path.join(BACKEND_ROUTES_DIR, file), 'utf8');
  const lines = content.split('\n');

  lines.forEach((line, idx) => {
    const match = line.match(/router\.(get|post|put|patch|delete)\s*\(\s*(['"`\[].*?['"`\]])\s*,/);
    if (match) {
      const method = match[1].toUpperCase();
      let routePath = match[2];
      
      let auth = 'None';
      if (line.includes('authenticateToken') || content.slice(Math.max(0, content.indexOf(line) - 200), content.indexOf(line)).includes('authenticateToken')) {
        auth = 'authenticateToken';
      }
      let role = 'Any';
      const roleMatch = line.match(/requireRole\s*\(\s*\[(.*?)\]\s*\)/);
      if (roleMatch) {
        role = roleMatch[1].replace(/['"\s]/g, '');
      }

      routes.push({
        method,
        path: routePath,
        file: `backend/src/routes/${file}`,
        line: idx + 1,
        auth,
        role
      });
    }
  });
});

console.log(`Found ${routes.length} backend routes across ${routeFiles.length} files:`);
routes.forEach(r => console.log(`${r.method.padEnd(6)} | ${r.path.padEnd(35)} | ${r.file.padEnd(35)}:${r.line} | auth:${r.auth} | role:${r.role}`));

console.log('\n==================================================');
console.log('FRONTEND API CALLS SCAN');
console.log('==================================================');

function scanFrontendCalls(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let results = [];

  entries.forEach(entry => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(scanFrontendCalls(fullPath));
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx') || entry.name.endsWith('.js'))) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');

      lines.forEach((line, idx) => {
        if (line.includes('fetch(') || line.includes('axios(') || line.includes('supabase.from(') || line.includes('supabase.rpc(')) {
          results.push({
            file: path.relative(path.join(__dirname, '..'), fullPath),
            line: idx + 1,
            code: line.trim()
          });
        }
      });
    }
  });
  return results;
}

const frontendCalls = scanFrontendCalls(FRONTEND_SRC_DIR);
console.log(`Found ${frontendCalls.length} frontend API/DB calls:`);
frontendCalls.slice(0, 30).forEach(c => console.log(`${c.file}:${c.line} -> ${c.code}`));
if (frontendCalls.length > 30) console.log(`... and ${frontendCalls.length - 30} more calls.`);

