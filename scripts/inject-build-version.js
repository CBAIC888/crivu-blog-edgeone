#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const PLACEHOLDER = '__BUILD_VERSION__';
const VERSION_FILE = path.join(ROOT, 'shared', 'build-version.json');
const TARGETS = [
  'about.html',
  'articles.html',
  'index.html',
  'issues.html',
  'post.html',
  'records.html',
  path.join('assets', 'js', 'app.js'),
  path.join('assets', 'js', 'comments.js'),
  path.join('assets', 'js', 'issues.js'),
  path.join('assets', 'js', 'post.js'),
  path.join('shared', 'site-pages.js'),
  path.join('functions', 'articles', '[slug].js'),
  path.join('functions', 'issues', '[id].js'),
];

// Always regenerate rss.xml from the latest posts/posts.json before stamping
// the build version. This makes RSS self-heal on every deploy regardless of
// which Cloudflare Pages build command is configured.
try {
  require('./generate-rss.js');
} catch (err) {
  process.stderr.write(`[inject-build-version] RSS regeneration failed: ${err && err.message ? err.message : err}\n`);
  process.exit(1);
}

const pad = (value) => String(value).padStart(2, '0');

const makeTimestamp = () => {
  const now = new Date();
  return [
    now.getUTCFullYear(),
    pad(now.getUTCMonth() + 1),
    pad(now.getUTCDate()),
  ].join('') + `-${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`;
};

const shortSha = () => {
  const envSha = process.env.CF_PAGES_COMMIT_SHA || process.env.GITHUB_SHA || process.env.COMMIT_REF;
  if (envSha) return String(envSha).slice(0, 7);
  try {
    return execSync('git rev-parse --short HEAD', { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return 'devbuild';
  }
};

const buildVersion =
  process.env.CF_PAGES_COMMIT_SHA || process.env.GITHUB_SHA || process.env.COMMIT_REF
    ? `${shortSha()}-${makeTimestamp()}`
    : process.env.BUILD_VERSION || `${shortSha()}-${makeTimestamp()}`;

fs.mkdirSync(path.dirname(VERSION_FILE), { recursive: true });
fs.writeFileSync(VERSION_FILE, `${JSON.stringify({ version: buildVersion }, null, 2)}\n`);

for (const relativePath of TARGETS) {
  const absolutePath = path.join(ROOT, relativePath);
  const source = fs.readFileSync(absolutePath, 'utf8');
  if (!source.includes(PLACEHOLDER)) {
    // 容錯：已經被替換過（例如同一檔案再次呼叫，或 Pages 二次 build），
    // 靜靜跳過，不讓流程失敗。
    process.stdout.write(`[inject-build-version] skip: ${relativePath} has no placeholder\n`);
    continue;
  }
  fs.writeFileSync(absolutePath, source.replaceAll(PLACEHOLDER, buildVersion));
}

process.stdout.write(`${buildVersion}\n`);
