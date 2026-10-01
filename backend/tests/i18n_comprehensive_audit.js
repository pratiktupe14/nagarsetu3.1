const fs = require('fs');
const path = require('path');

const content = fs.readFileSync('frontend/src/utils/i18n.ts', 'utf8');
const lines = content.split('\n');

function extractDict(startPattern, endPattern) {
  let inDict = false;
  const dict = {};
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.match(startPattern)) {
      inDict = true;
      continue;
    }
    if (inDict && line.match(endPattern)) {
      break;
    }
    if (inDict) {
      const m = line.match(/^\s*([a-zA-Z0-9_]+)\s*:\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/);
      if (m) {
        dict[m[1]] = m[2].slice(1, -1);
      }
    }
  }
  return dict;
}

const en = extractDict(/^\s*en:\s*\{/, /^\s*hi:\s*\{/);
const hi = extractDict(/^\s*hi:\s*\{/, /^\s*mr:\s*\{/);
const mr = extractDict(/^\s*mr:\s*\{/, /^\s*\}\s*;/);

const enKeys = Object.keys(en);
const hiKeys = Object.keys(hi);
const mrKeys = Object.keys(mr);

console.log('EN key count:', enKeys.length);
console.log('HI key count:', hiKeys.length);
console.log('MR key count:', mrKeys.length);

const missingInHi = enKeys.filter(k => !(k in hi));
const missingInMr = enKeys.filter(k => !(k in mr));

console.log('Missing in HI count:', missingInHi.length);
if (missingInHi.length > 0) console.log('Missing in HI:', missingInHi);

console.log('Missing in MR count:', missingInMr.length);
if (missingInMr.length > 0) console.log('Missing in MR:', missingInMr);
