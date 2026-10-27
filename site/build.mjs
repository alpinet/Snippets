// Turns docs/privacy-policy.md and docs/terms.md into site pages. No dependencies:
//   node site/build.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/_(.+?)_/g, '<em>$1</em>')
  .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');

function md(src) {
  const out = [];
  let list = false;
  for (const line of src.split('\n')) {
    if (/^- /.test(line)) {
      if (!list) out.push('<ul>');
      list = true;
      out.push(`<li>${inline(line.slice(2))}</li>`);
      continue;
    }
    if (list) out.push('</ul>');
    list = false;
    if (/^# /.test(line)) out.push(`<h1>${inline(line.slice(2))}</h1>`);
    else if (/^## /.test(line)) out.push(`<h2>${inline(line.slice(3))}</h2>`);
    else if (line.trim()) out.push(`<p>${inline(line)}</p>`);
  }
  if (list) out.push('</ul>');
  return out.join('\n');
}

const page = (title, body) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title} — Snippets</title><link rel="stylesheet" href="/style.css" /></head>
<body><main>${body}<footer><a href="/">Snippets</a></footer></main></body></html>
`;

for (const [src, out, title] of [
  ['docs/privacy-policy.md', 'site/privacy.html', 'Privacy Policy'],
  ['docs/terms.md', 'site/terms.html', 'Terms of Use'],
]) {
  writeFileSync(out, page(title, md(readFileSync(src, 'utf8'))));
  console.log('wrote', out);
}
writeFileSync('site/support.html', page('Support', `<h1>Support</h1>
<p>Questions, problems, or want your account deleted? Email <a href="mailto:SUPPORT@YOURDOMAIN">SUPPORT@YOURDOMAIN</a> — we answer within two days.</p>
<p>You can also delete your account any time in the app: <strong>Profile → Delete account</strong>. This permanently removes your profile, moments, photos and videos.</p>`));
console.log('wrote site/support.html');
