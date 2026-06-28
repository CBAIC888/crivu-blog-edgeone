#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SITE_ORIGIN = 'https://cbc688.com';
const MAX_ITEMS = 30;

const POSTS_FILE = path.join(ROOT, 'posts', 'posts.json');
const SITE_FILE = path.join(ROOT, 'posts', 'site.json');
const RSS_FILE = path.join(ROOT, 'rss.xml');

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

const articleUrl = (slug) => new URL(`/articles/${encodeURIComponent(String(slug || '').trim())}`, SITE_ORIGIN).toString();

// 一切時間以北京時間（Asia/Shanghai, UTC+8）為準。
const TZ_OFFSET_MINUTES = 8 * 60;
const RFC822_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const RFC822_MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];
const pad2 = (n) => String(n).padStart(2, '0');

const formatRfc822InBeijing = (date) => {
  const shifted = new Date(date.getTime() + TZ_OFFSET_MINUTES * 60 * 1000);
  const day = RFC822_DAYS[shifted.getUTCDay()];
  const d = pad2(shifted.getUTCDate());
  const month = RFC822_MONTHS[shifted.getUTCMonth()];
  const y = shifted.getUTCFullYear();
  const hh = pad2(shifted.getUTCHours());
  const mm = pad2(shifted.getUTCMinutes());
  const ss = pad2(shifted.getUTCSeconds());
  return `${day}, ${d} ${month} ${y} ${hh}:${mm}:${ss} +0800`;
};

const pubDate = (date) => {
  const raw = collapseWhitespace(date);
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const parsed = match ? new Date(`${raw}T00:00:00+08:00`) : new Date(raw);
  if (Number.isNaN(parsed.getTime())) return formatRfc822InBeijing(new Date());
  return formatRfc822InBeijing(parsed);
};

const postsData = readJson(POSTS_FILE, { items: [] });
const site = readJson(SITE_FILE, {});
const posts = (Array.isArray(postsData.items) ? postsData.items : postsData)
  .filter((post) => post?.published !== false)
  .filter((post) => collapseWhitespace(post?.slug) && collapseWhitespace(post?.title))
  .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
  .slice(0, MAX_ITEMS);

const siteName = collapseWhitespace(site.siteName) || 'CRIVU';
const siteDescription = collapseWhitespace(site.aboutBody) || `${siteName} 的個人博客更新。`;
const lastBuildDate = posts[0]?.date ? pubDate(posts[0].date) : formatRfc822InBeijing(new Date());

const items = posts
  .map((post) => {
    const url = articleUrl(post.slug);
    const description = trim(stripMarkdown(post.excerpt) || stripMarkdown(post.body), 180);
    return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${escapeXml(url)}</link>
      <guid isPermaLink="true">${escapeXml(url)}</guid>
      <pubDate>${escapeXml(pubDate(post.date))}</pubDate>
      <description>${escapeXml(description)}</description>
    </item>`;
  })
  .join('\n');

const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(siteName)}</title>
    <link>${escapeXml(`${SITE_ORIGIN}/`)}</link>
    <atom:link href="${escapeXml(`${SITE_ORIGIN}/rss.xml`)}" rel="self" type="application/rss+xml" />
    <description>${escapeXml(siteDescription)}</description>
    <language>zh-Hant</language>
    <lastBuildDate>${escapeXml(lastBuildDate)}</lastBuildDate>
${items}
  </channel>
</rss>
`;

fs.writeFileSync(RSS_FILE, rss);
process.stdout.write(`Generated rss.xml with ${posts.length} items\n`);
