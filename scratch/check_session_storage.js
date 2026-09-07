const fs = require('fs');
const path = require('path');

const report = JSON.parse(fs.readFileSync(path.join(__dirname, 'storage_classification_report.json'), 'utf8'));

report.sessionStorage.forEach(item => {
  console.log(`${item.file}:${item.line} -> ${item.text}`);
});
