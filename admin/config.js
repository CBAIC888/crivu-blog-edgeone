/*
 * CRIVU 後台：Decap CMS 配置（純 JS；避開 CSP unsafe-eval）。
 *
 * 設計原則：
 *  1. site.json 的結構保持 flat（不巢狀化），以確保所有前端渲染程式碼
 *     ( shared/site-pages.js、assets/js/*、functions/articles/[slug].js )
 *     現有的 `site.xxx` 存取方式不受影響。
 *  2. 欄位以前綴「「基本」「導航」「主題」…」做視覺分組，方便長列表中快速定位。
 *  3. 新增欄位都有安全預設，前端讀不到會走 fallback。
 */

window.CMS_MANUAL_INIT = true;

/* ---------- Backend ---------- */
const REPO_CONFIG = {
  name: 'github',
  repo: 'CBAIC888/crivu-blog',
  branch: 'main',
  base_url: 'https://cbc688.com',
  auth_endpoint: '/api/auth',
  commit_messages: {
    create: "content: create {{collection}} '{{slug}}'",
    update: "content: update {{collection}} '{{slug}}'",
    delete: "content: delete {{collection}} '{{slug}}'",
    uploadMedia: "media: upload '{{path}}'",
    deleteMedia: "media: delete '{{path}}'",
  },
};

/* ---------- 文章欄位 ---------- */
const POST_ITEM_FIELDS = [
  {
    label: '前台發布',
    name: 'published',
    widget: 'boolean',
    required: false,
    default: false,
    hint: '確認內容完成後再開啟；未開啟時不會出現在列表、搜尋、RSS 或詳情頁。',
  },
  { label: '標題', name: 'title', widget: 'string' },
  {
    label: '日期',
    name: 'date',
    widget: 'datetime',
    format: 'YYYY-MM-DDTHH:mm:ssZ',
    date_format: 'YYYY-MM-DD',
    time_format: 'HH:mm',
    picker_utc: false,
    hint: '選擇日期與時間（使用本地時區，點 Now 會抓當下本地時間）。',
  },
  { label: '分類', name: 'category', widget: 'string', required: false, hint: '例如：節氣 / 隨筆 / 京劇。用於頂部分類。' },
  {
    label: '標籤',
    name: 'tags',
    widget: 'list',
    required: false,
    allow_add: true,
    default: [],
    hint: '可多個；按 Enter 或點 Add 新增。',
  },
  {
    label: '摘要',
    name: 'excerpt',
    widget: 'text',
    required: false,
    hint: '列表卡片／社群分享顯示；不填會自動從內文擷取。',
  },
  {
    label: '封面',
    name: 'cover',
    widget: 'image',
    required: false,
    hint: '建議 1600×1000（橫向）。',
  },
  {
    label: '期刊 ID',
    name: 'issue',
    widget: 'string',
    required: false,
    hint: '對應《期刊》的 id 欄位（例如 2026Q1、jq01）；不填代表不歸期。',
  },
  {
    label: 'Slug（網址片段）',
    name: 'slug',
    widget: 'string',
    hint: '僅小寫英文、數字、連字號，例如 city-walk-notes；變更會導致舊連結失效。',
    pattern: ['^[a-z0-9]+(?:-[a-z0-9]+)*$', 'Slug 只能包含小寫英文、數字和連字號 -'],
  },
  {
    label: '內文',
    name: 'body',
    widget: 'markdown',
    hint: '支援 Markdown，可寫 **粗體**、## 標題、> 引用、- 列表、[紅字]{red}、==標記==；右側可即時預覽，發布後直接渲染為正式文章。',
  },
];

/* ---------- 期刊欄位 ---------- */
const ISSUE_ITEM_FIELDS = [
  {
    label: '前台發布',
    name: 'published',
    widget: 'boolean',
    required: false,
    default: false,
    hint: '確認封面、編者語及收錄文章後再開啟。',
  },
  {
    label: '期刊 ID',
    name: 'id',
    widget: 'string',
    hint: '唯一識別；文章以此 id 關聯。例如 2026Q1、jq01。',
    pattern: ['^[A-Za-z0-9_-]+$', 'ID 只能使用英文、數字、- 或 _'],
  },
  { label: '標題', name: 'title', widget: 'string' },
  { label: '主題（副標）', name: 'theme', widget: 'string', required: false, hint: '例如：傳統 · 書信' },
  {
    label: '封面',
    name: 'cover',
    widget: 'image',
    required: false,
    hint: '建議 1080×1440 直式；會以書本封面樣式呈現。',
  },
  {
    label: '發布日期',
    name: 'publishDate',
    widget: 'datetime',
    format: 'YYYY-MM-DDTHH:mm:ssZ',
    date_format: 'YYYY-MM-DD',
    time_format: 'HH:mm',
    picker_utc: false,
    required: false,
    hint: '選擇日期與時間（本地時區，Now 會抓當下本地時間）。',
  },
  { label: '編者語', name: 'editorNote', widget: 'text', required: false },
  {
    label: '收錄文章（Slug 列表）',
    name: 'posts',
    widget: 'list',
    required: false,
    allow_add: true,
    collapsed: false,
    field: { label: '文章 Slug', name: 'slug', widget: 'string' },
    hint: '依閱讀順序排列；填入文章 slug，可拖動調整順序。',
  },
];

/* ---------- 專題紀錄欄位 ---------- */
const RECORD_ITEM_FIELDS = [
  {
    label: '前台發布',
    name: 'published',
    widget: 'boolean',
    required: false,
    default: false,
    hint: '紀錄採嚴格發布；未開啟時首頁、紀錄頁及詳情頁均不顯示。',
  },
  {
    label: '紀錄 ID',
    name: 'id',
    widget: 'string',
    pattern: ['^[a-z0-9]+(?:-[a-z0-9]+)*$', 'ID 只能包含小寫英文、數字和連字號 -'],
    hint: '作為網址片段，例如 oral-history-01。',
  },
  { label: '標題', name: 'title', widget: 'string' },
  {
    label: '建立日期',
    name: 'date',
    widget: 'datetime',
    format: 'YYYY-MM-DDTHH:mm:ssZ',
    date_format: 'YYYY-MM-DD',
    time_format: 'HH:mm',
    picker_utc: false,
  },
  {
    label: '封面',
    name: 'cover',
    widget: 'image',
    hint: '建議 1080×1440 直式；首頁會裁切為統一比例。',
  },
  { label: '專題介紹', name: 'summary', widget: 'text', required: false },
  {
    label: '影片',
    name: 'videos',
    widget: 'list',
    required: false,
    collapsed: true,
    summary: '{{fields.title}}',
    fields: [
      { label: '前台顯示', name: 'published', widget: 'boolean', required: false, default: false },
      { label: '標題', name: 'title', widget: 'string' },
      { label: '封面', name: 'cover', widget: 'image' },
      { label: '介紹', name: 'description', widget: 'text', required: false },
      {
        label: '外部網址',
        name: 'url',
        widget: 'string',
        hint: '點擊後以新分頁開啟；請填完整 https:// 網址。',
        pattern: ['^https://.+$', '影片網址必須以 https:// 開頭'],
      },
    ],
  },
  {
    label: '照片',
    name: 'photos',
    widget: 'list',
    required: false,
    collapsed: true,
    summary: '{{fields.alt}}',
    fields: [
      { label: '前台顯示', name: 'published', widget: 'boolean', required: false, default: false },
      { label: '圖片', name: 'image', widget: 'image' },
      { label: '替代文字', name: 'alt', widget: 'string', required: false },
      { label: '介紹', name: 'description', widget: 'text', required: false },
    ],
  },
];

/* ---------- 站點設定欄位（flat，用「前綴」分組） ---------- */
const SITE_FIELDS = [
  /* ===== ① 基本 ===== */
  { label: '「基本」站名', name: 'siteName', widget: 'string' },
  {
    label: '「基本」網站描述（預設 SEO）',
    name: 'siteDescription',
    widget: 'text',
    required: false,
    hint: '各頁沒設自己的 description 時使用；也會作為預設 SEO 描述。',
  },
  {
    label: '「基本」關鍵字',
    name: 'siteKeywords',
    widget: 'string',
    required: false,
    hint: '以逗號分隔，例如：寫作, 節氣, 京劇',
  },
  {
    label: '「基本」網站 Favicon',
    name: 'favicon',
    widget: 'image',
    required: false,
    hint: '建議 512×512 PNG；瀏覽器分頁圖示。',
  },
  {
    label: '「基本」社群分享預設圖（OG Image）',
    name: 'ogImage',
    widget: 'image',
    required: false,
    hint: '建議 1200×630；文章沒設封面時由此接手。',
  },
  { label: '「基本」底部文案（Footer）', name: 'footerText', widget: 'string' },

  /* ===== ② 導航與搜尋 ===== */
  {
    label: '「導航」導航項目',
    name: 'nav',
    widget: 'list',
    required: false,
    summary: '{{fields.label}} → {{fields.href}}',
    fields: [
      { label: '名稱', name: 'label', widget: 'string' },
      { label: '連結', name: 'href', widget: 'string', hint: '可用 /、/articles.html、/issues.html、/records.html、/about.html 或外部 URL。' },
    ],
    hint: '未填時使用預設（首頁／文章／期刊／紀錄／關於）。',
  },
  {
    label: '「導航」搜尋框提示文字',
    name: 'searchPlaceholder',
    widget: 'string',
    required: false,
    default: '搜尋文章',
  },

  /* ===== ③ 主題外觀 ===== */
  {
    label: '「主題」顯示深淺切換按鈕',
    name: 'themeToggleEnabled',
    widget: 'boolean',
    required: false,
    default: true,
  },
  /* ===== ④ 文章頁 ===== */
  {
    label: '「文章頁」標題',
    name: 'articlesPageTitle',
    widget: 'string',
    required: false,
    default: '文章',
  },
  {
    label: '「文章頁」說明',
    name: 'articlesPageIntro',
    widget: 'text',
    required: false,
    default: '按時間順序閱讀全部文章。',
  },

  /* ===== ⑤ 期刊頁 ===== */
  {
    label: '「期刊頁」標題',
    name: 'issuesPageTitle',
    widget: 'string',
    required: false,
    default: '期刊',
  },
  {
    label: '「期刊頁」說明',
    name: 'issuesPageIntro',
    widget: 'text',
    required: false,
    default: '以期刊方式編排主題與收錄文章。',
  },
  {
    label: '「期刊頁」文章數模板',
    name: 'issueCountTemplate',
    widget: 'string',
    required: false,
    default: '收錄 {count} 篇文章',
    hint: '使用 {count} 代表數量；例如：收錄 {count} 篇。',
  },
  {
    label: '「期刊頁」空內容提示',
    name: 'issueEmptyText',
    widget: 'string',
    required: false,
    default: '暫無文章',
  },
  /* ===== ⑥ 關於頁 ===== */
  { label: '「關於頁」標題', name: 'aboutTitle', widget: 'string', default: '關於' },
  {
    label: '「關於頁」正文',
    name: 'aboutBody',
    widget: 'markdown',
    required: false,
    hint: '支援 Markdown，會以文章詳情頁的閱讀排版顯示。',
  },
];

window.DECAP_CMS_CONFIG = {
  load_config_file: false,
  backend: REPO_CONFIG,
  media_folder: 'assets/img/uploads',
  public_folder: '/assets/img/uploads',
  media_library: {
    name: 'crivu-r2-images',
  },
  publish_mode: 'editorial_workflow',
  slug: {
    encoding: 'ascii',
    clean_accents: true,
    sanitize_replacement: '-',
  },
  logo_url: '/assets/img/favicon.png',
  display_url: 'https://cbc688.com',
  collections: [
    {
      name: 'posts',
      label: '文章',
      label_singular: '文章',
      description: '管理文章；新內容預設不在前台顯示，確認後開啟「前台發布」。',
      sortable_fields: ['commit_date', 'commit_author'],
      files: [
        {
          name: 'posts',
          label: '文章列表',
          file: 'posts/posts.json',
          format: 'json',
          fields: [
            {
              label: '文章',
              name: 'items',
              widget: 'list',
              label_singular: '文章',
              summary: "{{fields.date | date('YYYY-MM-DD')}} · {{fields.title}}",
              hint: '按「Add 文章」新增；新文章預設加在最前。',
              collapsed: true,
              minimize_collapsed: true,
              add_to_top: true,
              fields: POST_ITEM_FIELDS,
            },
          ],
        },
      ],
    },
    {
      name: 'issues',
      label: '期刊',
      label_singular: '期刊',
      description: '管理期刊；新內容預設不在前台顯示，確認後開啟「前台發布」。',
      sortable_fields: ['commit_date', 'commit_author'],
      files: [
        {
          name: 'issues',
          label: '期刊列表',
          file: 'posts/issues.json',
          format: 'json',
          fields: [
            {
              label: '期刊',
              name: 'issues',
              widget: 'list',
              summary: '{{fields.id}} · {{fields.title}}',
              collapsed: true,
              minimize_collapsed: true,
              fields: ISSUE_ITEM_FIELDS,
            },
          ],
        },
      ],
    },
    {
      name: 'records',
      label: '紀錄',
      label_singular: '紀錄',
      description: '管理專題紀錄、外部影片與照片；紀錄及其素材均可分別控制前台顯示。',
      sortable_fields: ['commit_date', 'commit_author'],
      files: [
        {
          name: 'records',
          label: '紀錄列表',
          file: 'posts/records.json',
          format: 'json',
          fields: [
            {
              label: '紀錄',
              name: 'records',
              widget: 'list',
              summary: '{{fields.date}} · {{fields.title}}',
              collapsed: true,
              minimize_collapsed: true,
              add_to_top: true,
              fields: RECORD_ITEM_FIELDS,
            },
          ],
        },
      ],
    },
    {
      name: 'site',
      label: '站點設定',
      label_singular: '站點設定',
      description: '站名、導航、SEO、主題配色與各頁文案。',
      sortable_fields: ['commit_date', 'commit_author'],
      files: [
        {
          name: 'site',
          label: '站點資訊',
          file: 'posts/site.json',
          format: 'json',
          fields: SITE_FIELDS,
        },
      ],
    },
  ],
};
