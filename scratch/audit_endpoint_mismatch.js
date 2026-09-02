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

// Collect all backend routes with method & path pattern
const backendRoutes = [];
const routeFiles = getAllFiles(path.join(backendDir, 'routes'));

routeFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const basename = path.basename(file, '.routes.js');
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
    const fullPath = (routePath === '/' ? prefix : (prefix + routePath)).replace(/\/\//g, '/');
    backendRoutes.push({
      method,
      fullPath,
      file: path.relative(rootDir, file),
      rawPath: routePath
    });
  }
});

// Also app.js routes
backendRoutes.push({ method: 'GET', fullPath: '/api/health', file: 'backend/src/app.js' });
backendRoutes.push({ method: 'GET', fullPath: '/api', file: 'backend/src/app.js' });
backendRoutes.push({ method: 'GET', fullPath: '/', file: 'backend/src/app.js' });

console.log(`Backend route count: ${backendRoutes.length}`);

// Scan frontend files for fetch / axios / apiClient calls with URLs and Methods
const frontendCalls = [];

frontendFiles.forEach(file => {
  if (!file.endsWith('.ts') && !file.endsWith('.tsx') && !file.endsWith('.js')) return;
  const content = fs.readFileSync(file, 'utf8');
  const relPath = path.relative(rootDir, file);

  // match fetch(url, options) or apiClient.get/post/etc or axios.get/post/etc or string literal '/api/...'
  const lines = content.split('\n');
  lines.forEach((line, lineIdx) => {
    if (line.includes('/api/')) {
      const urlMatches = line.match(/['"`](\/api\/[^'"`\s\?\)]+)/g) || [];
      urlMatches.forEach(rawUrl => {
        const cleanedUrl = rawUrl.replace(/['"`]/g, '');
        // try to detect method on same line or nearby lines
        let method = 'GET';
        if (line.includes('method:') && line.includes('POST')) method = 'POST';
        else if (line.includes('method:') && line.includes('PUT')) method = 'PUT';
        else if (line.includes('method:') && line.includes('DELETE')) method = 'DELETE';
        else if (line.includes('method:') && line.includes('PATCH')) method = 'PATCH';
        else if (line.includes('.post(')) method = 'POST';
        else if (line.includes('.put(')) method = 'PUT';
        else if (line.includes('.delete(')) method = 'DELETE';
        else if (line.includes('.patch(')) method = 'PATCH';

        frontendCalls.push({
          file: relPath,
          line: lineIdx + 1,
          url: cleanedUrl,
          method,
          lineText: line.trim()
        });
      });
    }
  });
});

console.log(`Frontend API call locations found: ${frontendCalls.length}`);

// Match frontend calls to backend routes
console.log('\n=== ENDPOINT MISMATCH / MISSING ROUTE CHECK ===');
const missingBackendRoutes = [];

frontendCalls.forEach(call => {
  // Normalize dynamic template literals like /api/complaints/${id} -> /api/complaints/:id
  const normalizedUrl = call.url
    .replace(/\$\{[^}]+\}/g, ':param')
    .replace(/\/[\dabcdef\-]{8,}/gi, '/:id');

  const matchFound = backendRoutes.some(br => {
    const normBr = br.fullPath.replace(/:[a-zA-Z0-9_]+/g, ':param');
    return normBr === normalizedUrl || call.url.startsWith(br.fullPath.replace(/:[a-zA-Z0-9_]+/g, ''));
  });

  if (!matchFound) {
    missingBackendRoutes.push(call);
  }
});

console.log(`Found ${missingBackendRoutes.length} potential frontend API calls with NO matching backend route:`);
missingBackendRoutes.forEach(c => {
  console.log(`  [MISSING BACKEND ROUTE] ${c.file}:${c.line} -> ${c.method} ${c.url}`);
});

fs.writeFileSync(path.join(__dirname, 'endpoint_audit_result.json'), JSON.stringify({ backendRoutes, frontendCalls, missingBackendRoutes }, null, 2));
