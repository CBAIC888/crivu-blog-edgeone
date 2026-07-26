#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const PLACEHOLDER = '__BUILD_VERSION__';

const FILES = [
  '_headers',
  'about.html',
  'articles.html',
  'google974aaeec2e4594c9.html',
  'index.html',
  'issues.html',
  'post.html',
  'records.html',
  'robots.txt',
  'feed.xml',
];
const DIRECTORIES = ['assets', 'posts', 'records', 'shared'];
const VERSION_TARGETS = [
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
];

const copyPath = (relativePath) => {
  const from = path.join(ROOT, relativePath);
  const to = path.join(DIST, relativePath);
  fs.cpSync(from, to, { recursive: true });
};

const pad = (value) => String(value).padStart(2, '0');

const makeTimestamp = () => {
  const now = new Date();
  return `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}-${pad(now.getUTCHours())}${pad(
    now.getUTCMinutes()
  )}${pad(now.getUTCSeconds())}`;
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

const makeBuildVersion = () => `${shortSha()}-${makeTimestamp()}`;

const stampBuildVersion = (version) => {
  fs.mkdirSync(path.join(DIST, 'shared'), { recursive: true });
  fs.writeFileSync(path.join(DIST, 'shared', 'build-version.json'), `${JSON.stringify({ version }, null, 2)}\n`);
  for (const relativePath of VERSION_TARGETS) {
    const target = path.join(DIST, relativePath);
    const source = fs.readFileSync(target, 'utf8');
    fs.writeFileSync(target, source.replaceAll(PLACEHOLDER, version));
  }
};

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });
for (const file of FILES) copyPath(file);
for (const directory of DIRECTORIES) copyPath(directory);
stampBuildVersion(makeBuildVersion());

process.stdout.write(`Built EdgeOne static output at ${path.relative(ROOT, DIST)}\n`);
