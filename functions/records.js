import { loadSiteBundle, PAGE_HEADERS, renderRecordsPage } from '../shared/site-pages.js';

export async function onRequest(context) {
  const data = await loadSiteBundle(context);
  return new Response(renderRecordsPage(data), { headers: PAGE_HEADERS });
}
