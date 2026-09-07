const fs = require('fs');
const path = require('path');

const targets = ['localStorage', 'sessionStorage', 'mockData', 'demoData', 'fallbackData', 'mock', 'demo', 'fallback'];

function searchDir(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.git' && file !== 'dist' && file !== 'build') {
        searchDir(filePath, fileList);
      }
    } else if (/\.(tsx?|jsx?|html|css|json)$/.test(file)) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

const allFiles = searchDir(path.resolve(__dirname, '../frontend/src'));
const results = {};
targets.forEach(t => results[t] = []);

for (const f of allFiles) {
  const content = fs.readFileSync(f, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    targets.forEach(t => {
      // For short words like mock, demo, fallback, use regex word boundaries or exact checks
      let matched = false;
      if (['mock', 'demo', 'fallback'].includes(t)) {
        const regex = new RegExp(`\\b${t}`, 'i');
        matched = regex.test(line);
      } else {
        matched = line.toLowerCase().includes(t.toLowerCase());
      }
      if (matched) {
        results[t].push({
          file: path.relative(path.resolve(__dirname, '../frontend/src'), f).replace(/\\/g, '/'),
          line: idx + 1,
          content: line.trim()
        });
      }
    });
  });
}

fs.writeFileSync(path.resolve(__dirname, 'storage_audit_results.json'), JSON.stringify(results, null, 2));
console.log('Results written to scratch/storage_audit_results.json');
for (const t of targets) {
  console.log(`${t}: ${results[t].length} matches`);
}
