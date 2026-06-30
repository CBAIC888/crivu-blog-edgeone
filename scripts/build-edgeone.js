#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const PLACEHOLDER = '__BUILD_VERSION__';
const SITE_ORIGIN = 'https://cbc688.com';
const MAX_RSS_ITEMS = 30;

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
];
const DIRECTORIES = ['assets', 'posts', 'shared'];
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

const readJson = (file, fallback) => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
};

const collapseWhitespace = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

const escapeXml = (value) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');

const stripMarkdown = (value) =>
  collapseWhitespace(
    String(value ?? '')
      .replace(/\r\n/g, '\n')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/\[audio\]\((.*?)\)/g, ' ')
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '$1')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/^[-*]\s+/gm, '')
      .replace(/^\d+\.\s+/gm, '')
      .replace(/\n+/g, ' ')
  );

const trim = (value, maxLength) => {
  const text = collapseWhitespace(value);
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
};

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

const writeRss = () => {
  const postsData = readJson(path.join(ROOT, 'posts', 'posts.json'), { items: [] });
  const site = readJson(path.join(ROOT, 'posts', 'site.json'), {});
  const posts = (Array.isArray(postsData.items) ? postsData.items : postsData)
    .filter((post) => post?.published !== false)
    .filter((post) => collapseWhitespace(post?.slug) && collapseWhitespace(post?.title))
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
    .slice(0, MAX_RSS_ITEMS);
  const siteName = collapseWhitespace(site.siteName) || 'CRIVU';
  const description = collapseWhitespace(site.aboutBody) || `${siteName} 的個人博客更新。`;
  const items = posts
    .map((post) => {
      const url = new URL(`/articles/${encodeURIComponent(String(post.slug || '').trim())}`, SITE_ORIGIN).toString();
      return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${escapeXml(url)}</link>
      <guid isPermaLink="true">${escapeXml(url)}</guid>
      <description>${escapeXml(trim(stripMarkdown(post.excerpt) || stripMarkdown(post.body), 180))}</description>
    </item>`;
    })
    .join('\n');
  fs.writeFileSync(
    path.join(DIST, 'rss.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(siteName)}</title>
    <link>${escapeXml(`${SITE_ORIGIN}/`)}</link>
    <atom:link href="${escapeXml(`${SITE_ORIGIN}/rss.xml`)}" rel="self" type="application/rss+xml" />
    <description>${escapeXml(description)}</description>
    <language>zh-Hant</language>
${items}
  </channel>
</rss>
`
  );
};

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
writeRss();
stampBuildVersion(makeBuildVersion());

process.stdout.write(`Built EdgeOne static output at ${path.relative(ROOT, DIST)}\n`);
