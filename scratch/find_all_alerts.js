const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '../frontend/src');

function scanDir(dir, results = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      scanDir(fullPath, results);
    } else if (/\.(tsx?|jsx?)$/.test(file)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        if (/\balert\s*\(/.test(line)) {
          results.push({
            file: path.relative(srcDir, fullPath),
            lineNum: idx + 1,
            text: line.trim()
          });
        }
      });
    }
  }
  return results;
}

const alerts = scanDir(srcDir);
console.log(`TOTAL ALERTS FOUND: ${alerts.length}`);
alerts.forEach(a => {
  console.log(`${a.file}:${a.lineNum} -> ${a.text}`);
});
