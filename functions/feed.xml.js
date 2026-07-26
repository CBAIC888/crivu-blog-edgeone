/*
 * Dynamic RSS feed served from the new canonical `/feed.xml` address.
 *
 * Cloudflare Pages's configured build step for this project does not actually
 * run `node scripts/inject-build-version.js` (which would have regenerated
 * `feed.xml` from `posts/posts.json` on every deploy). As a result, the static
 * `feed.xml` committed to the repo became stale whenever a new post was
 * published via CMS.
 *
 * This Pages Function serves `/feed.xml` dynamically by reading the current
 * `posts/posts.json` and `posts/site.json` via the ASSETS binding, so the feed
 * is always in sync with the latest content — no build step required.
 */

import { loadSiteBundle } from '../shared/site-pages.js';

const SITE_ORIGIN = 'https://cbc688.com';
const MAX_ITEMS = 30;
const FEATURED_RECORD_ID = 'world-word-exploration';

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

const articleUrl = (slug) =>
  new URL(`/articles/${encodeURIComponent(String(slug || '').trim())}`, SITE_ORIGIN).toString();
const recordUrl = (record) =>
  new URL(record.page || `/records/${encodeURIComponent(String(record.id || '').trim())}/`, SITE_ORIGIN).toString();

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

const buildRss = ({ posts, records, site }) => {
  const validPosts = posts
    .filter((post) => post?.published !== false)
    .filter((post) => collapseWhitespace(post?.slug) && collapseWhitespace(post?.title))
    .map((post) => ({ ...post, entryType: 'post' }));
  const record = records.find(
    (item) => item?.published !== false && item?.id === FEATURED_RECORD_ID
  );
  const recordAlreadyListed = record && validPosts.some(
    (post) =>
      collapseWhitespace(post.page) === collapseWhitespace(record.page) ||
      collapseWhitespace(post.slug) === collapseWhitespace(record.id)
  );
  const entries = [
    ...validPosts,
    ...(record && !recordAlreadyListed ? [{ ...record, entryType: 'record' }] : []),
  ]
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
    .slice(0, MAX_ITEMS);

  const siteName = collapseWhitespace(site.siteName) || 'CRIVU';
  const siteDescription =
    collapseWhitespace(site.siteDescription) ||
    `${siteName} 收錄文章、期刊與專題紀錄。`;
  const lastBuildDate = entries[0]?.date
    ? pubDate(entries[0].date)
    : formatRfc822InBeijing(new Date());

  const items = entries
    .map((entry) => {
      const isRecord = entry.entryType === 'record';
      const url = collapseWhitespace(entry.page)
        ? new URL(entry.page, SITE_ORIGIN).toString()
        : isRecord
          ? recordUrl(entry)
          : articleUrl(entry.slug);
      const description = escapeXml(
        trim(
          stripMarkdown(entry.excerpt) ||
          stripMarkdown(entry.summary) ||
          stripMarkdown(entry.plainText) ||
          stripMarkdown(entry.body),
          180
        )
      );
      const category = collapseWhitespace(
        entry.category || entry.issue || (isRecord ? '專題紀錄' : '文章')
      );
      return `    <item>
      <title>${escapeXml(entry.title)}</title>
      <link>${escapeXml(url)}</link>
      <guid isPermaLink="true">${escapeXml(url)}</guid>
      <pubDate>${escapeXml(pubDate(entry.date))}</pubDate>
      <dc:creator>${escapeXml(siteName)}</dc:creator>
      <category>${escapeXml(category)}</category>
      <description>${description}</description>
    </item>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>${escapeXml(siteName)}</title>
    <link>${escapeXml(`${SITE_ORIGIN}/`)}</link>
    <atom:link href="${escapeXml(`${SITE_ORIGIN}/feed.xml`)}" rel="self" type="application/rss+xml" />
    <description>${escapeXml(siteDescription)}</description>
    <language>zh-Hant</language>
    <lastBuildDate>${escapeXml(lastBuildDate)}</lastBuildDate>
${items}
  </channel>
</rss>
`;
};

export async function onRequest(context) {
  const { posts, records, site } = await loadSiteBundle(context);
  const xml = buildRss({ posts, records, site });
  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=UTF-8',
      // Let feed readers revalidate but allow cheap conditional caching.
      'Cache-Control': 'public, max-age=0, must-revalidate',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
