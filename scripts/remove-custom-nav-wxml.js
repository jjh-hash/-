const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..');

function findWxml(dir, acc = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules' && e.name !== 'scripts') findWxml(p, acc);
    else if (e.isFile() && e.name.endsWith('.wxml')) acc.push(p);
  }
  return acc;
}

function removeNavBlock(s) {
  const lines = s.split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const t = line.trim();
    const isNavComment = (t.startsWith('<!--') && (t.includes('自定义导航') || t.includes('导航栏')));
    const isNavStart = t.startsWith('<view class="nav"') || t.startsWith('<view class="status-bar"') || t.startsWith('<view class="header"');
    if (isNavComment || isNavStart) {
      if (isNavComment) i++;
      let depth = 0;
      for (let k = i; k < lines.length; k++) {
        const l = lines[k];
        if (l.includes('<view')) depth++;
        if (l.includes('</view>')) { depth--; if (depth === 0) { i = k + 1; break; } }
      }
      continue;
    }
    out.push(line);
    i++;
  }
  return out.join('\n');
}

const files = findWxml(dir);
let n = 0;
for (const f of files) {
  let s = fs.readFileSync(f, 'utf8');
  if (!s.includes('class="nav"') && !s.includes('status-bar') && !s.includes('自定义导航') && !s.includes('class="header"')) continue;
  const before = s;
  s = removeNavBlock(s);
  if (s !== before) { fs.writeFileSync(f, s); n++; }
}
console.log('Updated', n, 'wxml files');
console.log('Remaining with nav/status-bar:', files.filter(f => fs.readFileSync(f, 'utf8').includes('class="nav"')).length);
console.log('Remaining with status-bar:', files.filter(f => fs.readFileSync(f, 'utf8').includes('status-bar')).length);