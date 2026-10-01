const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(full));
    } else if (file.endsWith('.tsx') || (file.endsWith('.ts') && !file.includes('i18n.ts') && !file.includes('.test.'))) {
      results.push(full);
    }
  });
  return results;
}

const files = walk('frontend/src');
console.log('Total files scanned:', files.length);

const targets = [
  'Reported On',
  'SLA Deadline',
  'Last Updated',
  'Quick Actions',
  'Priority Tasks',
  'View All Tasks',
  'OVERDUE SLA ALERT',
  'View Overdue Tasks',
  'New Assignments',
  'Due Soon',
  'Overdue SLA',
  'All assigned tasks are within SLA',
  'No citizen evidence photo available',
  'Locked citizen record',
  'Report Complaint',
  'My Complaints',
  'Sign Out',
  'Logout',
  'Save Changes',
  'Citizen View',
  'Admin View',
  'Field Staff View'
];

const matches = [];

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    // Check if line contains raw text between JSX tags like >Text<
    const m = line.match(/>([^<>{}\n]+)</);
    if (m) {
      const text = m[1].trim();
      if (text.length > 2 && targets.some(t => text.toLowerCase() === t.toLowerCase() || text.includes(t))) {
        if (!line.includes("t('") && !line.includes('t("') && !line.includes('translate')) {
          matches.push({ file: path.relative('frontend/src', file), line: idx + 1, text, code: line.trim() });
        }
      }
    }
  });
});

console.log('Found hardcoded UI strings:', matches.length);
matches.forEach(h => console.log(h.file + ':' + h.line, '->', h.text));
