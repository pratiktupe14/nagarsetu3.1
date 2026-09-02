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

const frontendFiles = getAllFiles(frontendDir);
const backendFiles = getAllFiles(backendDir);

console.log('=== DEEP AUDIT SCAN ===');

// 1. Scan Frontend API Endpoints Called
console.log('\n--- 1. Frontend API Call Scan ---');
const frontendEndpoints = new Map();
frontendFiles.forEach(file => {
  if (!file.endsWith('.ts') && !file.endsWith('.tsx') && !file.endsWith('.js')) return;
  const content = fs.readFileSync(file, 'utf8');
  const relPath = path.relative(rootDir, file);
  
  // match '/api/...' or `/api/...` or axios/fetch calls
  const matches = content.match(/\/api\/[a-zA-Z0-9_\-\/${}:]+/g) || [];
  matches.forEach(m => {
    // clean up quotes or template interpolations
    const cleaned = m.replace(/['"`]/g, '');
    if (!frontendEndpoints.has(cleaned)) {
      frontendEndpoints.set(cleaned, []);
    }
    frontendEndpoints.get(cleaned).push(relPath);
  });
});

console.log(`Found ${frontendEndpoints.size} unique /api/ endpoints referenced in frontend:`);
for (const [ep, files] of frontendEndpoints.entries()) {
  console.log(`  ${ep} -> referenced in ${files.length} file(s)`);
}

// 2. Scan Backend Route Endpoints
console.log('\n--- 2. Backend Express Routes Scan ---');
const backendRoutes = [];
const routeFiles = getAllFiles(path.join(backendDir, 'routes'));

routeFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const relPath = path.relative(rootDir, file);
  const basename = path.basename(file, '.routes.js');
  
  // Determine base prefix from app.js mounts
  let prefix = '/api/' + basename;
  if (basename === 'complaint') prefix = '/api/complaints';
  if (basename === 'department') prefix = '/api/departments';
  if (basename === 'announcement') prefix = '/api/announcements';
  if (basename === 'notification') prefix = '/api/notifications';

  const routeRegex = /router\.(get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]/gi;
  let match;
  while ((match = routeRegex.exec(content)) !== null) {
    const method = match[1].toUpperCase();
    const routePath = match[2];
    const fullPath = routePath === '/' ? prefix : (prefix + routePath).replace('//', '/');
    backendRoutes.push({ method, fullPath, file: relPath, rawPath: routePath });
  }
});

console.log(`Found ${backendRoutes.length} backend endpoints:`);
backendRoutes.forEach(r => {
  console.log(`  ${r.method.padEnd(6)} ${r.fullPath} (${r.file})`);
});

// 3. Scan for Buttons with Dummy/Broken Actions in Frontend
console.log('\n--- 3. Dummy / Broken Buttons & Links Scan ---');
frontendFiles.forEach(file => {
  if (!file.endsWith('.tsx')) return;
  const content = fs.readFileSync(file, 'utf8');
  const relPath = path.relative(rootDir, file);
  const lines = content.split('\n');

  lines.forEach((line, i) => {
    // href="#" or to="#"
    if (line.includes('href="#"') || line.includes('to="#"') || line.includes('to=""') || line.includes('href=""')) {
      console.log(`[BROKEN LINK] ${relPath}:${i + 1} -> ${line.trim()}`);
    }
    // onClick alert or dummy toast or alert('...')
    if (line.includes('alert(') || line.includes('alert `')) {
      console.log(`[BROWSER ALERT IN PRODUCTION UI] ${relPath}:${i + 1} -> ${line.trim()}`);
    }
    // handle click placeholder
    if (line.includes('console.log(') && (line.includes('click') || line.includes('submit') || line.includes('Button') || line.includes('handle'))) {
      console.log(`[CONSOLE LOG HANDLER] ${relPath}:${i + 1} -> ${line.trim()}`);
    }
  });
});

// 4. Scan Frontend vs Backend Auth / Token storage
console.log('\n--- 4. Token & Auth Storage Scan ---');
frontendFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const relPath = path.relative(rootDir, file);
  const lines = content.split('\n');
  lines.forEach((line, i) => {
    if (line.includes('localStorage.getItem') || line.includes('localStorage.setItem')) {
      if (line.includes('token') || line.includes('auth') || line.includes('user')) {
        console.log(`[LOCAL STORAGE AUTH] ${relPath}:${i + 1} -> ${line.trim()}`);
      }
    }
  });
});

console.log('\n=== DEEP AUDIT SCAN COMPLETE ===');
