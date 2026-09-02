const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const frontendDir = path.join(rootDir, 'frontend', 'src');
const backendDir = path.join(rootDir, 'backend', 'src');

console.log('--- DEEP CODE ANALYSIS INSPECTION ---');

function findPatterns(targetPath, pattern, label) {
  console.log(`\n=== Pattern: ${label} ===`);
  function scan(d) {
    if (!fs.existsSync(d)) return;
    const stat = fs.statSync(d);
    if (!stat.isDirectory()) {
      if (d.endsWith('.ts') || d.endsWith('.tsx') || d.endsWith('.js') || d.endsWith('.jsx')) {
        const content = fs.readFileSync(d, 'utf8');
        const lines = content.split('\n');
        lines.forEach((line, i) => {
          if (pattern.test(line)) {
            console.log(`[${label}] ${path.relative(rootDir, d)}:${i + 1} -> ${line.trim().substring(0, 100)}`);
          }
        });
      }
      return;
    }
    fs.readdirSync(d).forEach(item => {
      const full = path.join(d, item);
      if (fs.statSync(full).isDirectory()) {
        if (item !== 'node_modules' && item !== '.git') scan(full);
      } else if (full.endsWith('.ts') || full.endsWith('.tsx') || full.endsWith('.js') || full.endsWith('.jsx')) {
        const content = fs.readFileSync(full, 'utf8');
        const lines = content.split('\n');
        lines.forEach((line, i) => {
          if (pattern.test(line)) {
            console.log(`[${label}] ${path.relative(rootDir, d)}:${i + 1} -> ${line.trim().substring(0, 100)}`);
          }
        });
      }
    });
  }
  scan(targetPath);
}

// 1. Find hardcoded URLs
findPatterns(frontendDir, /http:\/\/localhost:5000|nagarsetu.*\.vercel\.app/g, 'HARDCODED API URL IN FRONTEND');

// 2. Find empty catches
findPatterns(frontendDir, /catch\s*\([^)]*\)\s*\{\s*\}/g, 'EMPTY CATCH BLOCK');

// 3. Find dummy click handlers
findPatterns(frontendDir, /onClick=\{\s*\(\)\s*=>\s*\{\s*\}\s*\}/g, 'DUMMY ONCLICK');

// 4. Find window alert
findPatterns(frontendDir, /\balert\(/g, 'WINDOW ALERT CALL');

// 5. App.tsx routes
findPatterns(path.join(frontendDir, 'App.tsx'), /<Route\s+/g, 'APP ROUTE DEFINITION');

console.log('--- INSPECTION COMPLETE ---');
