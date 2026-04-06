const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..');
const glob = (dir, pred, acc = []) => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules') glob(p, pred, acc);
    else if (e.isFile() && pred(p)) acc.push(p);
  }
  return acc;
};
const files = glob(dir, p => p.endsWith('index.json') && (p.includes('/pages/') || p.includes('\\pages\\')));
let n = 0;
for (const f of files) {
  let s = fs.readFileSync(f, 'utf8');
  if (!s.includes('navigationStyle')) continue;
  s = s.replace(/"navigationStyle"\s*:\s*"custom"\s*,?/g, '');
  s = s.replace(/,(\s*[}\]])/g, '$1');
  s = s.replace(/,+/g, ',');
  fs.writeFileSync(f, s);
  n++;
}
console.log('Removed navigationStyle from', n, 'files');
