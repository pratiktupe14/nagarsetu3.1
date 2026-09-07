const fs = require('fs');
const results = require('./storage_audit_results.json');

let out = '';
out += '=== LOCALSTORAGE MATCHES (' + results.localStorage.length + ') ===\n';
results.localStorage.forEach(m => {
  out += `${m.file}:${m.line} | ${m.content}\n`;
});

out += '\n=== SESSIONSTORAGE MATCHES (' + results.sessionStorage.length + ') ===\n';
results.sessionStorage.forEach(m => {
  out += `${m.file}:${m.line} | ${m.content}\n`;
});

out += '\n=== DEMO MATCHES (' + results.demo.length + ') ===\n';
results.demo.forEach(m => {
  out += `${m.file}:${m.line} | ${m.content}\n`;
});

out += '\n=== FALLBACK MATCHES (' + results.fallback.length + ') ===\n';
results.fallback.forEach(m => {
  out += `${m.file}:${m.line} | ${m.content}\n`;
});

fs.writeFileSync('scratch/all_audit_lines.txt', out);
console.log('Saved to scratch/all_audit_lines.txt');
