export const FALLBACK_COVER = '/assets/img/cover-01.svg';
export const DEFAULT_SITE_ORIGIN = 'https://cbc688.com';
export const BUILD_VERSION_PLACEHOLDER = '__BUILD_VERSION__';

export const isPublished = (item) => item?.published !== false;
export const isConfirmedRecord = (item) => item?.published === true;

const PLACEHOLDER_PATTERNS = [
  /yourname/i,
  /your city/i,
  /你的城市/u,
  /hello@yourname\.com/i,
  /這裡是你的個人博客/u,
  /your-domain\.com/i,
];

const collapseWhitespace = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

const resolveBaseOrigin = (baseOrigin) => {
  const raw = collapseWhitespace(baseOrigin);
  if (!raw) return DEFAULT_SITE_ORIGIN;
  try {
    return new URL(raw).origin;
  } catch {
    return DEFAULT_SITE_ORIGIN;
  }
};

export const isPlaceholderText = (value) => {
  const text = collapseWhitespace(value);
  if (!text) return false;
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(text));
};

export const normalizeText = (value, options = {}) => {
  const { allowPlaceholder = false } = options;
  const text = collapseWhitespace(value);
  if (!text) return '';
  if (!allowPlaceholder && isPlaceholderText(text)) return '';
  return text;
};

export const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeText(value, { allowPlaceholder: true }));

export const escapeHtml = (input) =>
  String(input ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

export const sanitizeUrl = (value, options = {}) => {
  const { allowHash = true, baseOrigin = DEFAULT_SITE_ORIGIN } = options;
  const input = String(value ?? '').trim();
  if (!input) return '#';
  if (allowHash && input.startsWith('#')) return '#';
  if (input.startsWith('/') || input.startsWith('./') || input.startsWith('../')) return input;

  try {
    const parsed = new URL(input, resolveBaseOrigin(baseOrigin));
    const protocol = parsed.protocol.toLowerCase();
    if (protocol === 'http:' || protocol === 'https:' || protocol === 'mailto:') return parsed.href;
  } catch {
    return '#';
  }

  return '#';
};

export const safeCoverUrl = (value, options = {}) => {
  const safe = sanitizeUrl(value, { allowHash: false, baseOrigin: options.baseOrigin });
  return safe === '#' ? FALLBACK_COVER : safe;
};

export const getBuildVersion = (doc = globalThis?.document) => {
  if (!doc || typeof doc.querySelector !== 'function') return '';
  const raw = doc.querySelector('meta[name="build-version"]')?.getAttribute('content') || '';
  const version = raw.trim();
  if (!version || version === BUILD_VERSION_PLACEHOLDER) return '';
  return version;
};

export const withBuildVersion = (url, version = getBuildVersion()) => {
  if (!version) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}v=${encodeURIComponent(version)}`;
};

export const articlePath = (slug) => {
  const normalized = normalizeText(slug, { allowPlaceholder: true });
  return normalized ? `/articles/${encodeURIComponent(normalized)}` : '/articles.html';
};

export const formatDate = (iso) => {
  const raw = normalizeText(iso, { allowPlaceholder: true });
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return raw;
  return `${match[1]}/${match[2]}/${match[3]}`;
};

/**
 * 將 ISO datetime (或純日期) 正規化為 `YYYY-MM-DD`，用於卡片列、搜尋結果等
 * 只需要顯示日期的場景。兼容舊的 `2026-05-11` 與新的 `2026-05-11T14:30:00+08:00`。
 */
export const toDisplayDate = (iso) => {
  const raw = normalizeText(iso, { allowPlaceholder: true });
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : raw;
};

const trimDescription = (value, maxLength) => {
  const text = collapseWhitespace(value);
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
};

export const stripMarkdown = (raw) => {
  const src = String(raw ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/\[audio\]\((.*?)\)/g, ' ')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[-*]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/\n+/g, ' ');
  return collapseWhitespace(src);
};

export const buildDescription = (post, maxLength = 140) => {
  const excerpt = normalizeText(post?.excerpt);
  if (excerpt) return trimDescription(excerpt, maxLength);
  const bodyText = stripMarkdown(post?.body ?? '');
  return trimDescription(bodyText, maxLength);
};

export const buildSearchText = (post) => {
  const tags = Array.isArray(post?.tags) ? post.tags.map((tag) => normalizeText(tag, { allowPlaceholder: true })) : [];
  return collapseWhitespace(
    [
      normalizeText(post?.title, { allowPlaceholder: true }),
      normalizeText(post?.excerpt, { allowPlaceholder: true }),
      stripMarkdown(post?.body ?? ''),
      normalizeText(post?.category, { allowPlaceholder: true }),
      normalizeText(post?.issue, { allowPlaceholder: true }),
      tags.join(' '),
    ]
      .filter(Boolean)
      .join(' ')
  );
};

const buildSnippetWindow = (text, query, maxLength) => {
  const source = collapseWhitespace(text);
  if (!source) return '';
  if (!query) return trimDescription(source, maxLength);

  const lower = source.toLowerCase();
  const target = query.toLowerCase();
  const at = lower.indexOf(target);
  if (at === -1) return trimDescription(source, maxLength);

  const radius = Math.max(18, Math.floor((maxLength - target.length) / 2));
  const start = Math.max(0, at - radius);
  const end = Math.min(source.length, at + target.length + radius);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < source.length ? '…' : '';
  return `${prefix}${source.slice(start, end).trim()}${suffix}`;
};

export const buildSearchSnippet = (post, query, maxLength = 88) => {
  const normalizedQuery = normalizeText(query, { allowPlaceholder: true });
  const candidates = [
    normalizeText(post?.excerpt, { allowPlaceholder: true }),
    stripMarkdown(post?.body ?? ''),
    normalizeText(post?.title, { allowPlaceholder: true }),
  ].filter(Boolean);

  const matched = candidates.find((candidate) => candidate.toLowerCase().includes(normalizedQuery.toLowerCase()));
  if (matched) return buildSnippetWindow(matched, normalizedQuery, maxLength);
  return buildDescription(post, maxLength);
};

const inlineMarkdownLink = (label, href, baseOrigin) => {
  const safeHref = sanitizeUrl(href, { baseOrigin });
  return `<a href="${escapeHtml(safeHref)}" target="_blank" rel="noopener noreferrer nofollow">${escapeHtml(label)}</a>`;
};

const normalizeCmsMarkdown = (raw) =>
  String(raw || '')
    .replace(/\r\n/g, '\n')
    // Some pasted/CMS-saved text contains protective slashes before Markdown
    // markers. Remove those only where they block formatting syntax.
    .replace(/^\\(#{1,6}\s+)/gm, '$1')
    .replace(/^\\(>\s?)/gm, '$1')
    .replace(/^\\([-*]\s+)/gm, '$1')
    .replace(/^\\(\d+\.\s+)/gm, '$1')
    .replace(/^\\(---+)$/gm, '$1')
    .replace(/\\(\*{1,3})([^*\n]+?)\\\1/g, '$1$2$1')
    .replace(/\\(\*\*[^*\n]+?\*\*)/g, '$1')
    .replace(/\\(\*[^*\n]+?\*)/g, '$1')
    .replace(/\\(~~[^~\n]+?~~)/g, '$1')
    .replace(/\\(`[^`\n]+?`)/g, '$1')
    .replace(/\\(!\[[^\]\n]*?\]\([^)]+?\))/g, '$1')
    .replace(/\\(\[[^\]\n]+?\]\([^)]+?\))/g, '$1')
    .replace(/([。，、；：！？.,;:!?])\\\1/g, '$1')
    .replace(/\\\\([^\\\n]+?)\\\\/g, '**$1**')
    .replace(/\\([^\\\n]+?)\\/g, '*$1*')
    .replace(/\\(?=。|，|、|；|：|！|？|）|」|』|》|〉|\.|,|;|:|!|\?|\)|\]|}|$)/gm, '');

const inlineMarkdown = (text, baseOrigin) => {
  const escaped = escapeHtml(text);
  return escaped
    .replace(/`([^`]+?)`/g, '<code>$1</code>')
    .replace(/\[([^\]\n]+?)\]\{(red|blue|green|gold|gray|seal)\}/g, '<span class="md-color md-color--$2">$1</span>')
    .replace(/==(.*?)==/g, '<mark>$1</mark>')
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/_(.+?)_/g, '<em>$1</em>')
    .replace(/~~(.+?)~~/g, '<del>$1</del>')
    .replace(/ {2,}$/gm, '<br />')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, href) => inlineMarkdownLink(label, href, baseOrigin));
};

export const simpleMarkdown = (raw, options = {}) => {
  const baseOrigin = resolveBaseOrigin(options.baseOrigin);
  const src = normalizeCmsMarkdown(raw);
  const lines = src.split('\n');
  const out = [];
  let listType = '';
  let paragraph = [];
  let quote = [];
  let inCode = false;
  let code = [];

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    const html = paragraph
      .map((item, index) => {
        const hardBreak = /\\$/.test(item);
        const clean = hardBreak ? item.replace(/\\$/, '') : item;
        const separator = index < paragraph.length - 1 ? (hardBreak ? '<br />' : ' ') : '';
        return `${inlineMarkdown(clean, baseOrigin)}${separator}`;
      })
      .join('');
    out.push(`<p>${html}</p>`);
    paragraph = [];
  };

  const closeList = () => {
    if (!listType) return;
    out.push(`</${listType}>`);
    listType = '';
  };

  const flushQuote = () => {
    if (quote.length === 0) return;
    out.push(`<blockquote>${quote.map((item) => `<p>${inlineMarkdown(item, baseOrigin)}</p>`).join('')}</blockquote>`);
    quote = [];
  };

  const flushCode = () => {
    out.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
    code = [];
  };

  const renderAudioBlock = (audioSrc, title, caption) => {
    const safeSrc = sanitizeUrl(audioSrc, { allowHash: false, baseOrigin });
    if (safeSrc === '#') return '';
    const safeTitle = escapeHtml(title || '');
    const safeCaption = escapeHtml(caption || '');
    const titleHtml = safeTitle ? `<div class="post-audio-title">${safeTitle}</div>` : '';
    const captionHtml = safeCaption ? `<figcaption>${safeCaption}</figcaption>` : '';
    return `<figure class="post-audio">${titleHtml}<audio controls preload="metadata" src="${escapeHtml(safeSrc)}"></audio>${captionHtml}</figure>`;
  };

  const renderImageBlock = (imageSrc, altText) => {
    const safeSrc = sanitizeUrl(imageSrc, { allowHash: false, baseOrigin });
    if (safeSrc === '#') return '';
    const safeAlt = escapeHtml(altText || '');
    const captionHtml = safeAlt ? `<figcaption>${safeAlt}</figcaption>` : '';
    return `<figure class="post-image"><img src="${escapeHtml(safeSrc)}" alt="${safeAlt}" loading="lazy" />${captionHtml}</figure>`;
  };

  const splitTableRow = (row) =>
    row
      .trim()
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((cell) => cell.trim());

  const isTableDivider = (row) => {
    const cells = splitTableRow(row);
    return cells.length > 1 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
  };

  const renderTable = (headerLine, dividerLine, rowLines) => {
    const headers = splitTableRow(headerLine);
    const aligns = splitTableRow(dividerLine).map((cell) => {
      if (/^:-+:$/.test(cell)) return 'center';
      if (/-+:$/.test(cell)) return 'right';
      if (/^:-+/.test(cell)) return 'left';
      return '';
    });
    const alignAttr = (index) => (aligns[index] ? ` style="text-align:${aligns[index]}"` : '');
    const headHtml = headers
      .map((cell, index) => `<th${alignAttr(index)}>${inlineMarkdown(cell, baseOrigin)}</th>`)
      .join('');
    const bodyHtml = rowLines
      .map((row) => {
        const cells = splitTableRow(row);
        return `<tr>${headers
          .map((_cell, index) => `<td${alignAttr(index)}>${inlineMarkdown(cells[index] || '', baseOrigin)}</td>`)
          .join('')}</tr>`;
      })
      .join('');
    return `<table><thead><tr>${headHtml}</tr></thead><tbody>${bodyHtml}</tbody></table>`;
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const trimmed = line.trim();

    if (/^(```|~~~)/.test(trimmed)) {
      if (inCode) {
        flushCode();
        inCode = false;
      } else {
        flushParagraph();
        flushQuote();
        closeList();
        inCode = true;
        code = [];
      }
      continue;
    }

    if (inCode) {
      code.push(line);
      continue;
    }

    if (!trimmed) {
      flushParagraph();
      flushQuote();
      closeList();
      continue;
    }

    const audioMatch = trimmed.match(/^\[audio\]\((.*?)\)$/);
    if (audioMatch) {
      const next = (lines[i + 1] || '').trim();
      const titleMatch = next.match(/^<!--\s*title:(.*?)\s*-->$/);
      if (titleMatch) {
        const captionLine = (lines[i + 2] || '').trim();
        const captionMatch = captionLine.match(/^\*(.*?)\*$/);
        const blockHtml = renderAudioBlock(audioMatch[1], titleMatch[1], captionMatch ? captionMatch[1] : '');
        if (blockHtml) {
          flushParagraph();
          flushQuote();
          closeList();
          out.push(blockHtml);
        }
        i += captionMatch ? 2 : 1;
        continue;
      }
    }

    const imageMatch = trimmed.match(/^!\[(.*?)\]\((.*?)\)$/);
    if (imageMatch) {
      let caption = '';
      let skip = 0;
      // 後一行若是 <!-- preset:... --> 就忽略
      const nextLine = (lines[i + 1] || '').trim();
      const presetMatch = nextLine.match(/^<!--\s*preset:.*?\s*-->$/);
      if (presetMatch) skip = 1;
      // 再往後若是 *caption* 則作為說明
      const afterPresetLine = (lines[i + 1 + skip] || '').trim();
      const captionMatch = afterPresetLine.match(/^\*(.*?)\*$/);
      if (captionMatch) {
        caption = captionMatch[1];
        skip += 1;
      }
      const altText = caption || imageMatch[1];
      const blockHtml = renderImageBlock(imageMatch[2], altText);
      if (blockHtml) {
        flushParagraph();
        flushQuote();
        closeList();
        out.push(blockHtml);
      }
      i += skip;
      continue;
    }

    // 孤立的 preset 註釋（無前置圖）直接跳過，避免漏出
    if (/^<!--\s*preset:.*?\s*-->$/.test(trimmed)) {
      continue;
    }

    if (/^---+$/.test(trimmed)) {
      flushParagraph();
      flushQuote();
      closeList();
      out.push('<hr />');
      continue;
    }

    if (trimmed.includes('|') && isTableDivider(lines[i + 1] || '')) {
      const rows = [];
      let cursor = i + 2;
      while (cursor < lines.length && lines[cursor].trim().includes('|')) {
        rows.push(lines[cursor]);
        cursor += 1;
      }
      flushParagraph();
      flushQuote();
      closeList();
      out.push(renderTable(line, lines[i + 1], rows));
      i = cursor - 1;
      continue;
    }

    if (/^(\*\*\*+|___+)$/.test(trimmed)) {
      flushParagraph();
      flushQuote();
      closeList();
      out.push('<hr />');
      continue;
    }

    if (/^>\s?/.test(trimmed)) {
      flushParagraph();
      closeList();
      quote.push(trimmed.replace(/^>\s?/, ''));
      continue;
    }

    if (/^###\s+/.test(trimmed)) {
      flushParagraph();
      flushQuote();
      closeList();
      out.push(`<h3>${inlineMarkdown(trimmed.replace(/^###\s+/, ''), baseOrigin)}</h3>`);
      continue;
    }

    if (/^##\s+/.test(trimmed)) {
      flushParagraph();
      flushQuote();
      closeList();
      out.push(`<h2>${inlineMarkdown(trimmed.replace(/^##\s+/, ''), baseOrigin)}</h2>`);
      continue;
    }

    if (/^#\s+/.test(trimmed)) {
      flushParagraph();
      flushQuote();
      closeList();
      out.push(`<h1>${inlineMarkdown(trimmed.replace(/^#\s+/, ''), baseOrigin)}</h1>`);
      continue;
    }

    if (/^第[一二三四五六七八九十百千〇零\d]+[场場回幕折]\s*$/.test(trimmed)) {
      flushParagraph();
      flushQuote();
      closeList();
      out.push(`<h2>${inlineMarkdown(trimmed, baseOrigin)}</h2>`);
      continue;
    }

    if (/^[-*]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed)) {
      flushParagraph();
      flushQuote();
      const nextListType = /^\d+\.\s+/.test(trimmed) ? 'ol' : 'ul';
      if (listType && listType !== nextListType) closeList();
      if (!listType) {
        out.push(`<${nextListType}>`);
        listType = nextListType;
      }
      let itemText = trimmed.replace(/^([-*]|\d+\.)\s+/, '');
      const taskMatch = itemText.match(/^\[( |x|X)\]\s+(.*)$/);
      if (taskMatch) {
        const checked = taskMatch[1].toLowerCase() === 'x' ? ' checked' : '';
        itemText = `<input type="checkbox" disabled${checked} /> ${inlineMarkdown(taskMatch[2], baseOrigin)}`;
        out.push(`<li class="task-list-item">${itemText}</li>`);
      } else {
        out.push(`<li>${inlineMarkdown(itemText, baseOrigin)}</li>`);
      }
      continue;
    }

    closeList();
    flushQuote();
    paragraph.push(trimmed);
  }

  if (inCode) flushCode();
  flushParagraph();
  flushQuote();
  closeList();
  return out.join('\n');
};

export const renderNavItems = (items, currentPath, options = {}) => {
  const baseOrigin = resolveBaseOrigin(options.baseOrigin);
  if (!Array.isArray(items) || items.length === 0) return '';

  return items
    .filter((item) => item && normalizeText(item.label) && normalizeText(item.href, { allowPlaceholder: true }))
    .map((item) => {
      const safeHref = sanitizeUrl(item.href, { baseOrigin });
      const normalized = new URL(safeHref, baseOrigin).pathname.replace(/\/index\.html$/, '/') || '/';
      const isHome = normalized === '/';
      const normalizedBase = normalized.endsWith('.html') ? normalized.replace(/\.html$/, '') : normalized;
      const isActive = isHome
        ? currentPath === '/'
        : currentPath === normalized ||
          currentPath.startsWith(`${normalized}/`) ||
          (normalizedBase !== normalized && (currentPath === normalizedBase || currentPath.startsWith(`${normalizedBase}/`)));
      return `<a href="${escapeHtml(safeHref)}"${isActive ? ' class="active"' : ''}>${escapeHtml(item.label)}</a>`;
    })
    .join('');
};
