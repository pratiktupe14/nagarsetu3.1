const fs = require('fs');
const path = require('path');

const report = JSON.parse(fs.readFileSync(path.join(__dirname, 'storage_classification_report.json'), 'utf8'));

console.log('=== LOCALSTORAGE.GETITEM USAGES ===');
const getItems = {};
report.localStorageGet.forEach(item => {
  const match = item.text.match(/localStorage\.getItem\(['"`]([^'"`]+)['"`]\)/);
  const key = match ? match[1] : item.text;
  getItems[key] = (getItems[key] || 0) + 1;
});
console.log(JSON.stringify(getItems, null, 2));

console.log('\n=== LOCALSTORAGE.SETITEM USAGES ===');
const setItems = {};
report.localStorageSet.forEach(item => {
  const match = item.text.match(/localStorage\.setItem\(['"`]([^'"`]+)['"`]/);
  const key = match ? match[1] : item.text;
  setItems[key] = (setItems[key] || 0) + 1;
});
console.log(JSON.stringify(setItems, null, 2));

console.log('\n=== SESSIONSTORAGE USAGES ===');
const sessItems = {};
report.sessionStorage.forEach(item => {
  sessItems[item.file] = (sessItems[item.file] || 0) + 1;
});
console.log(JSON.stringify(sessItems, null, 2));
