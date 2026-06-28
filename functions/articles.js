import { loadSiteBundle, PAGE_HEADERS, renderArticlesPage } from '../shared/site-pages.js';

export async function onRequest(context) {
  const data = await loadSiteBundle(context);
  return new Response(renderArticlesPage(data), { headers: PAGE_HEADERS });
}
