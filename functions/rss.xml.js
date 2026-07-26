export function onRequest() {
  return new Response('此訂閱地址已停用，請重新加入 https://cbc688.com/feed.xml\n', {
    status: 410,
    headers: {
      'Content-Type': 'text/plain; charset=UTF-8',
      'Cache-Control': 'no-store',
      'Link': '</feed.xml>; rel="alternate"; type="application/rss+xml"',
    },
  });
}
