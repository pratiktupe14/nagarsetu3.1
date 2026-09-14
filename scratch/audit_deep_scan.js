const fs = require('fs');
const path = require('path');

const BACKEND_SRC = path.join(__dirname, '../backend/src');
const FRONTEND_SRC = path.join(__dirname, '../frontend/src');

function getFiles(dir, exts = ['.js', '.ts', '.tsx', '.jsx']) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFiles(filePath, exts));
    } else {
      if (exts.some(ext => file.endsWith(ext))) {
        results.push(filePath);
      }
    }
  });
  return results;
}

const backendFiles = getFiles(BACKEND_SRC);
const frontendFiles = getFiles(FRONTEND_SRC);

console.log('====================================================');
console.log('DEEP COMPREHENSIVE AUDIT SCAN (PART 2)');
console.log('====================================================\n');

// 1. REPEATED POSITIONAL PARAMETERS IN SQL QUERIES
console.log('--- 1. SQL QUERIES WITH REPEATED POSITIONAL PARAMETERS ---');
backendFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const rel = path.relative(path.join(__dirname, '..'), file);
  
  // Find SQL templates with $N
  const lines = content.split('\n');
  lines.forEach((line, lineIdx) => {
    const matches = line.match(/\$\d+/g);
    if (matches && matches.length > 1) {
      const counts = {};
      matches.forEach(m => counts[m] = (counts[m] || 0) + 1);
      const repeated = Object.keys(counts).filter(m => counts[m] > 1);
      if (repeated.length > 0 && !rel.includes('announcement.routes.js')) {
        console.log(`[SQL REPEATED PARAM] ${rel}:${lineIdx + 1}`);
        console.log(`  Repeated params: ${repeated.join(', ')}`);
        console.log(`  Line: ${line.trim()}`);
      }
    }
  });
});

// Check multi-line SQL string queries in backend routes
backendFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const rel = path.relative(path.join(__dirname, '..'), file);

  const queryBlocks = content.match(/query\s*\(\s*`[^`]+`/g) || [];
  queryBlocks.forEach(block => {
    const params = block.match(/\$\d+/g) || [];
    const counts = {};
    params.forEach(p => counts[p] = (counts[p] || 0) + 1);
    const repeated = Object.keys(counts).filter(p => counts[p] > 1);
    if (repeated.length > 0 && !rel.includes('announcement.routes.js')) {
      console.log(`[SQL BLOCK REPEATED PARAM] ${rel}`);
      console.log(`  Repeated params: ${repeated.join(', ')}`);
      console.log(`  Block snippet: ${block.substring(0, 120).replace(/\s+/g, ' ')}...`);
    }
  });
});

// 2. HARDCODED IDS / FALLBACKS IN BACKEND ROUTES
console.log('\n--- 2. HARDCODED UUIDs / IDs IN BACKEND ROUTES ---');
backendFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const rel = path.relative(path.join(__dirname, '..'), file);
  if (rel.includes('routes')) {
    const hardcodedUuids = content.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi) || [];
    if (hardcodedUuids.length > 0) {
      console.log(`[HARDCODED UUID IN ROUTE] ${rel}: ${hardcodedUuids.join(', ')}`);
    }
  }
});

// 3. MULTER ERROR HANDLING IN FILE UPLOAD ROUTES
console.log('\n--- 3. MULTER UNHANDLED ERROR IN FILE UPLOAD ROUTES ---');
backendFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const rel = path.relative(path.join(__dirname, '..'), file);

  if ((content.includes('multer') || content.includes('upload.')) && rel.includes('routes')) {
    if (!content.includes('MulterError') && !content.includes('err.code')) {
      console.log(`[MULTER UNHANDLED ERROR ROUTE] ${rel}`);
    }
  }
});

// 4. STORAGE KEY INCONSISTENCIES IN FRONTEND
console.log('\n--- 4. STORAGE KEY INCONSISTENCIES IN FRONTEND ---');
frontendFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const rel = path.relative(path.join(__dirname, '..'), file);

  const keys = content.match(/localStorage\.(?:getItem|setItem|removeItem)\(['"]([^'"]+)['"]/g) || [];
  keys.forEach(k => {
    const key = k.match(/['"]([^'"]+)['"]/)[1];
    if (key.includes('token') && key !== 'nagarsetu_token') {
      console.log(`[TOKEN KEY INCONSISTENCY] ${rel}: key = '${key}'`);
    }
  });
});

// 5. ENVIRONMENT VARIABLES AND CONFIGURATION
console.log('\n--- 5. CONFIG & ENV VARIABLE CHECK ---');
const envExamplePath = path.join(__dirname, '../.env.example');
const rootEnvPath = path.join(__dirname, '../.env');
console.log(`.env.example exists: ${fs.existsSync(envExamplePath)}`);
console.log(`.env exists: ${fs.existsSync(rootEnvPath)}`);

console.log('\n====================================================');
console.log('AUDIT SCAN COMPLETE');
console.log('====================================================');
