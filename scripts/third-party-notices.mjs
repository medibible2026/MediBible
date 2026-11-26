// Collects licence texts of the production dependencies bundled into the web app.
//   Output: public/THIRD_PARTY_NOTICES.txt (served with the site, linked from About)
import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { root } from './lib/stepbible.mjs';

const tree = JSON.parse(execSync('npm ls --omit=dev --all --json', { cwd: root, encoding: 'utf8' }));
const pkgs = new Map();
(function walk(deps) {
  for (const [name, info] of Object.entries(deps || {})) {
    if (!pkgs.has(name)) pkgs.set(name, info.version);
    walk(info.dependencies);
  }
})(tree.dependencies);

const parts = [
  'MediBible bundles the following open-source packages. Their licences are reproduced below.',
  '',
];
for (const [name, version] of [...pkgs].sort((a, b) => a[0].localeCompare(b[0]))) {
  const dir = join(root, 'node_modules', name);
  const meta = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
  const file = existsSync(dir) && readdirSync(dir).find((f) => /^(licen[cs]e|copying)(\.|$)/i.test(f));
  const text = file ? readFileSync(join(dir, file), 'utf8').trim() : `License: ${meta.license ?? 'see package'}`;
  parts.push('='.repeat(72), `${name}@${version} (${meta.license ?? 'unknown'})`, meta.homepage ?? '', '-'.repeat(72), text, '');
}
writeFileSync(join(root, 'public', 'THIRD_PARTY_NOTICES.txt'), parts.join('\n'));
console.log(`third-party notices: ${pkgs.size} packages`);
