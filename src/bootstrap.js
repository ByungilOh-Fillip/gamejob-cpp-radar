import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const required = ['axios', 'cheerio', 'express'];
const missing = required.some(pkg => !fs.existsSync(`${root}/node_modules/${pkg}`));

if (missing) {
  console.log('[bootstrap] dependencies missing → npm install');
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(npm, ['install'], { cwd: root, stdio: 'inherit', shell: false });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
