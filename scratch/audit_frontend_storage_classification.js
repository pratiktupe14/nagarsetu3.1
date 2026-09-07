const fs = require('fs');
const path = require('path');

const FRONTEND_SRC = path.join(__dirname, '../frontend/src');

function getAllFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      getAllFiles(fullPath, fileList);
    } else if (/\.(ts|tsx|js|jsx)$/.test(file)) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

const files = getAllFiles(FRONTEND_SRC);

const results = {
  localStorageGet: [],
  localStorageSet: [],
  localStorageRemove: [],
  sessionStorage: [],
  mockData: [],
  demoData: [],
  fallbackData: []
};

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  const relPath = path.relative(path.join(__dirname, '../frontend'), file).replace(/\\/g, '/');

  lines.forEach((line, idx) => {
    const lineNum = idx + 1;
    const trimmed = line.trim();

    if (line.includes('localStorage.getItem(')) {
      results.localStorageGet.push({ file: relPath, line: lineNum, text: trimmed });
    }
    if (line.includes('localStorage.setItem(')) {
      results.localStorageSet.push({ file: relPath, line: lineNum, text: trimmed });
    }
    if (line.includes('localStorage.removeItem(') || line.includes('localStorage.clear(')) {
      results.localStorageRemove.push({ file: relPath, line: lineNum, text: trimmed });
    }
    if (line.includes('sessionStorage.')) {
      results.sessionStorage.push({ file: relPath, line: lineNum, text: trimmed });
    }
    if (line.includes('mockData')) {
      results.mockData.push({ file: relPath, line: lineNum, text: trimmed });
    }
    if (line.includes('demoData')) {
      results.demoData.push({ file: relPath, line: lineNum, text: trimmed });
    }
    if (line.includes('fallbackData')) {
      results.fallbackData.push({ file: relPath, line: lineNum, text: trimmed });
    }
  });
}

fs.writeFileSync(path.join(__dirname, 'storage_classification_report.json'), JSON.stringify(results, null, 2));

console.log('AUDIT SUMMARY:');
console.log(`- localStorage.getItem: ${results.localStorageGet.length}`);
console.log(`- localStorage.setItem: ${results.localStorageSet.length}`);
console.log(`- localStorage.removeItem/clear: ${results.localStorageRemove.length}`);
console.log(`- sessionStorage: ${results.sessionStorage.length}`);
console.log(`- mockData: ${results.mockData.length}`);
console.log(`- demoData: ${results.demoData.length}`);
console.log(`- fallbackData: ${results.fallbackData.length}`);
