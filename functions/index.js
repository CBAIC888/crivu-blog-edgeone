import { loadSiteBundle, PAGE_HEADERS, renderHomePage } from '../shared/site-pages.js';

export async function onRequest(context) {
  const data = await loadSiteBundle(context);
  return new Response(renderHomePage(data), { headers: PAGE_HEADERS });
}
