import { loadSiteBundle, PAGE_HEADERS, renderIssuesPage } from '../shared/site-pages.js';

export async function onRequest(context) {
  const data = await loadSiteBundle(context);
  return new Response(renderIssuesPage(data), { headers: PAGE_HEADERS });
}
