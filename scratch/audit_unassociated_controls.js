const fs = require('fs');
const path = require('path');

function getFiles(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      getFiles(fullPath, files);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.jsx')) {
      files.push(fullPath);
    }
  }
  return files;
}

const allFiles = getFiles('frontend/src');
console.log('Total TSX/JSX files:', allFiles.length);

let totalControls = 0;
let unassociatedCount = 0;
const unassociatedList = [];

for (const file of allFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  
  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];
    if (/<(input|select|textarea)\b/i.test(line)) {
      const snippet = lines.slice(idx, idx + 10).join(' ');
      const tagMatch = snippet.match(/<(input|select|textarea)([\s\S]*?)>/i);
      if (tagMatch) {
        const tag = tagMatch[1];
        const attrs = tagMatch[2];
        
        if (/type=['"](hidden|button|submit|image|reset)['"]/i.test(attrs)) {
          continue;
        }
        
        totalControls++;
        const hasIdMatch = attrs.match(/\bid=['"]([^'"]+)['"]/i) || attrs.match(/\bid=\{([^}]+)\}/i);
        const hasAriaLabel = /\baria-label=/i.test(attrs);
        const hasAriaLabelledBy = /\baria-labelledby=/i.test(attrs);
        
        let hasLabelHtmlFor = false;
        if (hasIdMatch) {
          const idVal = hasIdMatch[1].replace(/['"]/g, '').trim();
          if (content.includes(`htmlFor="${idVal}"`) || content.includes(`htmlFor='${idVal}'`) || content.includes(`htmlFor={${idVal}}`)) {
            hasLabelHtmlFor = true;
          }
        }

        if (!hasAriaLabel && !hasAriaLabelledBy && !hasLabelHtmlFor) {
          unassociatedCount++;
          unassociatedList.push({ file: path.relative('frontend/src', file), line: idx + 1, tag, attrs: attrs.replace(/\s+/g, ' ').trim() });
        }
      }
    }
  }
}

console.log('\n--- FORM CONTROL AUDIT RESULTS ---');
console.log('Total Form Controls:', totalControls);
console.log('Unassociated Controls:', unassociatedCount);
console.log(JSON.stringify(unassociatedList, null, 2));
