const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const frontendDir = path.join(rootDir, 'frontend', 'src');
const backendDir = path.join(rootDir, 'backend', 'src');

console.log('--- STARTING COMPREHENSIVE AUDIT ANALYSIS ---');

// Helper to recursively list files
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

// 1. Check for Duplicate Files (.jsx vs .tsx)
console.log('\n=== 1. DUPLICATE / SHADOW FILES ===');
const frontendFileSet = new Set(frontendFiles.map(f => path.relative(frontendDir, f)));
frontendFiles.forEach(f => {
  if (f.endsWith('.jsx')) {
    const tsxEquivalent = f.replace(/\.jsx$/, '.tsx');
    if (fs.existsSync(tsxEquivalent)) {
      console.log(`[DUPLICATE FILE] ${path.relative(rootDir, f)} shadows/duplicates ${path.relative(rootDir, tsxEquivalent)}`);
    }
  }
});

// 2. Scan Frontend Services for Endpoints
console.log('\n=== 2. FRONTEND API CALLS INVENTORIED ===');
const apiCalls = [];
const apiRegex = /(?:apiClient|fetch|axios)\.(get|post|put|delete|patch)\s*\(\s*[`'"]([^`'"]+)[`'"]/gi;
const fetchRegex = /fetch\s*\(\s*[`'"]([^`'"]+)[`'"]/gi;

frontendFiles.forEach(file => {
  if (!file.endsWith('.ts') && !file.endsWith('.tsx') && !file.endsWith('.js') && !file.endsWith('.jsx')) return;
  const content = fs.readFileSync(file, 'utf8');
  let match;
  while ((match = apiRegex.exec(content)) !== null) {
    apiCalls.push({
      file: path.relative(rootDir, file),
      method: match[1].toUpperCase(),
      endpoint: match[2]
    });
  }
});
console.log(`Found ${apiCalls.length} frontend API call references.`);

// 3. Scan Backend Routes for Endpoints
console.log('\n=== 3. BACKEND ROUTES INVENTORIED ===');
const backendRoutes = [];
const routeRegex = /router\.(get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]/gi;

const routeFiles = getAllFiles(path.join(backendDir, 'routes'));
routeFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const basename = path.basename(file);
  let prefix = '/api';
  if (basename.includes('admin')) prefix = '/api/admin';
  else if (basename.includes('auth')) prefix = '/api/auth';
  else if (basename.includes('complaint')) prefix = '/api/complaints';
  else if (basename.includes('department')) prefix = '/api/departments';
  else if (basename.includes('announcement')) prefix = '/api/announcements';
  else if (basename.includes('notification')) prefix = '/api/notifications';
  else if (basename.includes('officer')) prefix = '/api/officer';
  else if (basename.includes('staff')) prefix = '/api/staff';
  else if (basename.includes('maps')) prefix = '/api/maps';
  else if (basename.includes('ai')) prefix = '/api/ai';

  let match;
  while ((match = routeRegex.exec(content)) !== null) {
    backendRoutes.push({
      file: path.relative(rootDir, file),
      method: match[1].toUpperCase(),
      path: match[2],
      fullPath: prefix + match[2]
    });
  }
});
console.log(`Found ${backendRoutes.length} backend route handlers.`);

// 4. Scan Frontend for Empty Click Handlers & Buttons doing nothing
console.log('\n=== 4. FRONTEND DUMMY / EMPTY HANDLERS ===');
const emptyHandlerRegex = /onClick=\{\s*\(\)\s*=>\s*\{\s*\}\s*\}/g;
const consoleOnlyHandlerRegex = /onClick=\{\s*\(\)\s*=>\s*console\.log\([^)]*\)\s*\}/g;
const todoRegex = /\/\/\s*TODO/gi;

frontendFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if (emptyHandlerRegex.test(line)) {
      console.log(`[EMPTY HANDLER] ${path.relative(rootDir, file)}:${idx + 1} -> onClick={() => {}}`);
    }
    if (consoleOnlyHandlerRegex.test(line)) {
      console.log(`[CONSOLE ONLY HANDLER] ${path.relative(rootDir, file)}:${idx + 1} -> onClick={() => console.log(...)}`);
    }
    if (todoRegex.test(line)) {
      console.log(`[TODO COMMENT] ${path.relative(rootDir, file)}:${idx + 1} -> ${line.trim()}`);
    }
  });
});

// 5. Scan Frontend Pages for Hardcoded Mock Data
console.log('\n=== 5. FRONTEND HARDCODED MOCK DATA & STUBS ===');
const mockDataRegex = /const\s+mock[A-Za-z0-9_]*\s*=/g;
frontendFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if (mockDataRegex.test(line)) {
      console.log(`[MOCK DATA] ${path.relative(rootDir, file)}:${idx + 1} -> ${line.trim().substring(0, 80)}`);
    }
  });
});

// 6. Scan for Silent Catch blocks (.catch(() => {}))
console.log('\n=== 6. SILENT ERROR CATCH BLOCKS ===');
const silentCatchRegex = /\.catch\(\s*\(\s*\)\s*=>\s*\{\s*\}\s*\)/g;
frontendFiles.concat(backendFiles).forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if (silentCatchRegex.test(line)) {
      console.log(`[SILENT CATCH] ${path.relative(rootDir, file)}:${idx + 1} -> ${line.trim()}`);
    }
  });
});

console.log('\n--- AUDIT ANALYSIS COMPLETE ---');
