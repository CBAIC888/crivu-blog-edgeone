# Deployment Runbook

## Goal
- Use one deployment path only.
- Avoid repeated trial-and-error pushes.
- Stop immediately if the public site does not move to the pushed commit.

## Standard Deploy Flow
1. Confirm local state once:
   - `git -C /Users/cbaic/Desktop/開發/網站/blog status --short`
   - If unrelated changes exist, stop and separate them first.
2. Validate the change locally before pushing:
   - Syntax check changed JS files with `node --check`.
   - If article routing changed, verify the function modules import cleanly.
   - Run `node scripts/inject-build-version.js` from `/Users/cbaic/Desktop/開發/網站/blog` in a clean checkout or throwaway copy to verify build-version injection works.
3. Create one commit only:
   - `git -C /Users/cbaic/Desktop/開發/網站/blog add -A`
   - `git -C /Users/cbaic/Desktop/開發/網站/blog commit -m "<message>"`
4. Sync with remote once before push:
   - `GIT_TERMINAL_PROMPT=0 git -C /Users/cbaic/Desktop/開發/網站/blog fetch origin main`
   - `git -C /Users/cbaic/Desktop/開發/網站/blog status -sb`
   - If branch is behind, rebase once:
     - `GIT_TERMINAL_PROMPT=0 git -C /Users/cbaic/Desktop/開發/網站/blog rebase origin/main`
5. Push once:
   - `git -C /Users/cbaic/Desktop/開發/網站/blog push origin main`

## Cloudflare Pages Build Settings
- Root directory: `/Users/cbaic/Desktop/開發/網站/blog`
- Build command: `node scripts/inject-build-version.js` (this also regenerates `rss.xml` automatically)
- Build output directory: `.`
- The build step must run in Cloudflare Pages so `__BUILD_VERSION__` placeholders are replaced during deployment.
- Cloudflare Cache Rules for `/assets/*` must respect query strings; do not enable ignore-query-string behavior for asset caching.
- `_headers` must not put `Cache-Control: no-store` under `/*`; otherwise `/assets/*` will inherit no-store and Cloudflare will bypass cache. Keep no-store on HTML routes only.

## EdgeOne Makers Test Deploy
- Project: `crivu-blog-edgeone`
- Project id: `makers-zbammqd5whtw`
- Stable domain: `https://crivu-blog-edgeone-0zj7kihz.edgeone.dev`
- Test custom domain: `https://eo.cbc688.com`
- Region: Global availability, excluding Mainland China.
- Build command: `npm run build`
- Install command: `npm install`
- Output directory: `.`
- Bound GitHub repo: `CBAIC888/crivu-blog-edgeone`

EdgeOne currently deploys from a separate GitHub repo, not the main `CBAIC888/crivu-blog` repo. After committing to the main repo, also sync the same content into the EdgeOne repo:

1. Fetch the EdgeOne repo once:
   - `git fetch https://github.com/CBAIC888/crivu-blog-edgeone.git main:refs/remotes/edgeone/main`
2. Create a throwaway sync branch from the EdgeOne remote:
   - `git switch -c edgeone-sync edgeone/main`
3. Cherry-pick the main repo commit:
   - `git cherry-pick <commit-sha>`
4. Push fast-forward to EdgeOne:
   - `git push https://github.com/CBAIC888/crivu-blog-edgeone.git edgeone-sync:main`
5. Return local checkout to normal:
   - `git switch main`
   - `git branch -D edgeone-sync`

Do not force-push EdgeOne unless intentionally replacing its history. The EdgeOne repo was created with its own initial commit, so direct `git push ... HEAD:main` from the main repo can fail with `fetch first`.

## Media Delivery Rules
- Frontend content must use same-origin paths such as `/assets/img/uploads/example.jpeg`.
- Do not store `https://raw.githubusercontent.com/...` in `posts/*.json`; it is slow and unreliable from Mainland China.
- Prefer compressed `.jpeg` for photo-like images. Keep PNG only for images that need transparency or crisp line art.
- Keep article/list images near 1600px wide unless a larger original is truly needed.
- After image changes, verify:
  - `rg -n "raw\\.githubusercontent\\.com/CBAIC888/crivu-blog/main" posts`
  - asset references exist locally.
  - `curl -I https://cbc688.com/assets/...`
  - `curl -I https://eo.cbc688.com/assets/...`

## Comments Setup
- Comments use Cloudflare Pages Functions + D1. The public form never stores plaintext IP, user agent, or email. Email is optional and stored only as a salted hash.
- D1 binding name must be `COMMENTS_DB`.
- Schema file: `migrations/0001_comments.sql`.
- Required production environment variables:
  - `TURNSTILE_SITE_KEY`: public Turnstile site key.
  - `TURNSTILE_SECRET_KEY`: secret Turnstile key. Set as a Pages secret, never commit it.
  - `COMMENT_HASH_SALT`: random secret salt for hashing email/IP/user-agent. Set as a Pages secret, never commit it.
- Optional development-only variable:
  - `COMMENTS_ALLOW_UNVERIFIED=true` bypasses Turnstile. Do not enable this in production.
- Moderation is manual by default:
  - New comments are inserted as `pending`.
  - Public pages only read `approved`.
  - Admin review is available from `/admin` via the floating `評論審核` button after GitHub CMS login.
- EdgeOne `eo.cbc688.com` should use `https://cbc688.com/api/comments` as the comments API. Do not create a second comments database for EdgeOne unless intentionally splitting comment stores.
- If comments do not submit, check in this order:
  - D1 binding exists on the Cloudflare Pages production environment.
  - Turnstile site key and secret key are set.
  - `_headers` / CSP allows `https://challenges.cloudflare.com`.
  - `/api/comments?config=1` returns `submissionEnabled: true`.

## Post-Deploy Verification
- Verify GitHub accepted the push and note the exact commit SHA.
- Check these public URLs:
  - `/`
  - `/articles`
  - `/issues`
  - `/about`
  - `/articles/<slug>`
- For article pages, confirm returned HTML already contains:
  - `<title>`
  - `<meta name="description">`
  - `<meta name="build-version">`
  - `<h1>`
  - body text
- Check versioned asset/data requests:
  - `curl -I "https://cbc688.com/assets/js/app.js?v=<build-version>"`
  - `curl -I "https://cbc688.com/posts/posts.json?v=<build-version>"`
- Confirm headers are:
  - HTML: `no-store, no-cache, must-revalidate, max-age=0`
  - `/posts/*`: `public, max-age=0, must-revalidate`
  - `/assets/*`: `public, max-age=31536000, immutable`
- Confirm image delivery:
  - Homepage HTML has no `raw.githubusercontent.com`.
  - A newly uploaded image returns `200 OK` from both `https://cbc688.com/assets/...` and `https://eo.cbc688.com/assets/...`.
  - Asset responses must not include `no-store`.
- Confirm comments:
  - `curl https://cbc688.com/api/comments?config=1`
  - `curl "https://cbc688.com/api/comments?slug=<slug>"`
  - Article pages include `/assets/js/comments.js`.
  - If D1 or Turnstile is not configured yet, the form should stay disabled instead of accepting unsafe submissions.

## If Public Site Still Shows Old HTML
- Do **not** keep pushing.
- Assume deployment chain is broken until proven otherwise.
- Check these exact items in Cloudflare Pages:
  - Production branch is `main`
  - Latest production deployment commit SHA matches GitHub
  - Project root points to this repo root
  - Pages Functions are enabled and detected
  - Custom domain `cbc688.com` is attached to the same project
  - Cache is purged after a successful production deploy

## Known Failure Patterns
- Git push succeeds but public HTML stays old:
  - Usually wrong Pages project, wrong production branch, stale deployment, or custom domain bound to another project.
- Mainland visitors still report slow images on `eo.cbc688.com`:
  - Remember EdgeOne Makers is configured as global excluding Mainland China. It improves routing outside Mainland China but is not Mainland CDN.
  - Check whether images are same-origin and compressed before changing infrastructure.
- `main -> main (fetch first)`:
  - Remote advanced; fetch/rebase once, then push.
- `index.lock` errors:
  - Another git command was started in parallel.
  - Never run `git status`, `git add`, `git commit`, `git pull`, `git push` in parallel.

## Rules
- Never redeploy multiple times just to “see if it works”.
- One code change batch should map to one commit and one push.
- If one successful push does not change production, switch from “deploying” to “fixing deployment configuration”.
