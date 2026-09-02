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

const frontendServiceFiles = getAllFiles(path.join(frontendDir, 'services'));
const frontendPagesFiles = getAllFiles(path.join(frontendDir, 'pages'));
const frontendComponentsFiles = getAllFiles(path.join(frontendDir, 'components'));
const backendRouteFiles = getAllFiles(path.join(backendDir, 'routes'));

console.log('=== DETAILED ROUTE & SERVICE ANALYSIS ===');

// Parse Backend Routes
const backendEndpoints = [];

backendRouteFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const relPath = path.relative(rootDir, file);
  const basename = path.basename(file, '.routes.js');
  let prefix = '/api/' + basename;
  if (basename === 'complaint') prefix = '/api/complaints';
  if (basename === 'department') prefix = '/api/departments';
  if (basename === 'announcement') prefix = '/api/announcements';
  if (basename === 'notification') prefix = '/api/notifications';

  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    const routeMatch = line.match(/router\.(get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"](.*)/i);
    if (routeMatch) {
      const method = routeMatch[1].toUpperCase();
      const subPath = routeMatch[2];
      const restOfLine = routeMatch[3];
      const fullPath = (subPath === '/' ? prefix : (prefix + subPath)).replace(/\/\//g, '/');
      const hasAuth = line.includes('authenticateToken') || content.substring(Math.max(0, content.indexOf(line) - 200), content.indexOf(line)).includes('authenticateToken');
      const hasRole = line.includes('requireRole') || restOfLine.includes('requireRole');
      backendEndpoints.push({
        method,
        fullPath,
        subPath,
        file: relPath,
        line: idx + 1,
        hasAuth,
        hasRole
      });
    }
  });
});

console.log(`Backend Endpoints Count: ${backendEndpoints.length}`);

// Parse Frontend API calls across services, pages, components
const frontendCalls = [];

const allFrontendCodeFiles = [...frontendServiceFiles, ...frontendPagesFiles, ...frontendComponentsFiles];

allFrontendCodeFiles.forEach(file => {
  if (!file.endsWith('.ts') && !file.endsWith('.tsx') && !file.endsWith('.js') && !file.endsWith('.jsx')) return;
  const content = fs.readFileSync(file, 'utf8');
  const relPath = path.relative(rootDir, file);
  const lines = content.split('\n');

  lines.forEach((line, idx) => {
    // Look for fetch or axios or apiClient or string `/api/...` or `${getApiUrl()}/api/...`
    if (line.includes('/api/') || line.includes('getApiUrl()')) {
      // extract URL pattern
      const match = line.match(/(?:fetch|axios|apiClient|\`|\')([^'`"]*\/api\/[^'`"]*)/i);
      if (match) {
        let rawUrl = match[1];
        let method = 'GET';
        if (line.includes('POST') || line.includes('.post')) method = 'POST';
        else if (line.includes('PUT') || line.includes('.put')) method = 'PUT';
        else if (line.includes('DELETE') || line.includes('.delete')) method = 'DELETE';
        else if (line.includes('PATCH') || line.includes('.patch')) method = 'PATCH';

        frontendCalls.push({
          file: relPath,
          line: idx + 1,
          rawUrl,
          method,
          snippet: line.trim()
        });
      }
    }
  });
});

console.log(`Frontend API calls parsed: ${frontendCalls.length}`);

fs.writeFileSync(path.join(__dirname, 'route_inventory.json'), JSON.stringify({ backendEndpoints, frontendCalls }, null, 2));
console.log('Saved route_inventory.json');
