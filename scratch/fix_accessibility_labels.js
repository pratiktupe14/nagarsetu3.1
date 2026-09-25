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

function deriveAriaLabel(tag, attrs, line) {
  // Try placeholder
  const phMatch = attrs.match(/placeholder=['"]([^'"]+)['"]/i);
  if (phMatch && phMatch[1]) {
    return phMatch[1];
  }
  
  // Try name
  const nameMatch = attrs.match(/name=['"]([^'"]+)['"]/i);
  if (nameMatch && nameMatch[1]) {
    return nameMatch[1].replace(/([A-Z])/g, ' $1').replace(/[-_]/g, ' ').trim();
  }

  // Try id
  const idMatch = attrs.match(/id=['"]([^'"]+)['"]/i);
  if (idMatch && idMatch[1]) {
    return idMatch[1].replace(/([A-Z])/g, ' $1').replace(/[-_]/g, ' ').trim();
  }

  // Try value variable name
  const valMatch = attrs.match(/value=\{([a-zA-Z0-9_.]+)\}/);
  if (valMatch && valMatch[1]) {
    const varName = valMatch[1].split('.').pop();
    let label = varName.replace(/([A-Z])/g, ' $1').replace(/Filter$/i, ' filter').replace(/Query$/i, '').trim();
    if (label) return label;
  }

  if (tag === 'select') return 'Select option';
  if (tag === 'textarea') return 'Input text';
  if (/type=['"]checkbox['"]/i.test(attrs)) return 'Select item';
  if (/type=['"]file['"]/i.test(attrs)) return 'Upload file';
  if (/type=['"]password['"]/i.test(attrs)) return 'Password';
  if (/type=['"]email['"]/i.test(attrs)) return 'Email address';
  if (/type=['"]number['"]/i.test(attrs)) return 'Enter number';
  if (/type=['"]date['"]/i.test(attrs)) return 'Select date';
  
  return 'Form input';
}

const allFiles = getFiles('frontend/src');
let totalFixed = 0;

for (const file of allFiles) {
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;
  let lines = content.split('\n');
  let modified = false;

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];
    if (/<(input|select|textarea)\b/i.test(line)) {
      // Find full tag opening
      const rest = lines.slice(idx).join('\n');
      const tagMatch = rest.match(/^([\s\S]*?<(input|select|textarea)([\s\S]*?)>)/i);
      if (tagMatch) {
        const fullOpeningTag = tagMatch[1];
        const tag = tagMatch[2];
        const attrs = tagMatch[3];

        if (/type=['"](hidden|button|submit|image|reset)['"]/i.test(attrs)) {
          continue;
        }

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
          const ariaLabelText = deriveAriaLabel(tag, attrs, line);
          // Insert aria-label right after <tag
          const replacementTag = fullOpeningTag.replace(
            new RegExp(`<${tag}`, 'i'),
            `<${tag} aria-label="${ariaLabelText}"`
          );
          
          restSubst = rest.replace(fullOpeningTag, replacementTag);
          lines = (lines.slice(0, idx).join('\n') + '\n' + restSubst).split('\n');
          content = lines.join('\n');
          modified = true;
          totalFixed++;
        }
      }
    }
  }

  if (modified && content !== originalContent) {
    fs.writeFileSync(file, content, 'utf8');
  }
}

console.log(`Successfully added aria-label to ${totalFixed} form controls across frontend files.`);
