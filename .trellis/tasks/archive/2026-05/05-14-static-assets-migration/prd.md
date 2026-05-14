# Migrate Static Files to Cloudflare Workers Static Assets

## Summary

Move `robots.txt` and `index.html` from webpack-inlined strings served by the Worker router to Cloudflare Workers Static Assets, reducing Worker bundle size and leveraging CDN edge caching for static content.

## Background

Currently both files are imported as raw strings via webpack `asset/source` loaders and served through itty-router handlers:
- `router.get('/', () => html(indexHtml))` — returns the full HTML page
- `router.get('/robots.txt', () => text(robots))` — returns robots.txt

This means every request to `/` or `/robots.txt` consumes Worker CPU time to construct a Response from an inlined string. These files have zero server-side dynamic logic (the HTML uses client-side JS for dynamic content).

## Requirements

### Must Have

1. Create a `public/` directory at project root containing:
   - `public/index.html` (moved from `src/index.html`)
   - `public/robots.txt` (moved from `src/robots.txt`)

2. Add `[assets]` configuration to `wrangler.toml`:
   ```toml
   [assets]
   directory = "./public"
   ```

3. Remove from `src/main.js`:
   - `import indexHtml from './index.html'`
   - `import robots from './robots.txt'`
   - `router.get('/', () => html(indexHtml))`
   - `router.get('/robots.txt', () => text(robots))`

4. Remove `html` and `text` from itty-router imports if no longer used elsewhere.

5. Verify the webpack config still builds cleanly (the `.html` and `.txt` loader rules can remain — they're harmless and may be used by future files, or can be removed if no other files use them).

### Should Have

6. Remove the `src/index.html` and `src/robots.txt` source files (they now live in `public/`).

### Won't Do

- No changes to dynamic routes (`/@:id`, `/get/@:id`, `/record/@:id`, `/heart-beat`)
- No favicon.ico changes (current 404 behavior is intentional)
- No changes to theme system or counter logic

## Technical Notes

- Cloudflare Static Assets serve files with correct `Content-Type` based on extension automatically.
- Static Assets routes take priority over Worker routes for matching paths, so removing the Worker routes is clean (no conflict).
- The `index.html` uses `window.location.origin` for all dynamic URL construction — no server-side templating needed.
- `html` import from itty-router may still be needed if other routes use it in the future, but currently only the index route uses it. `text` is not used elsewhere either. Both can be removed.

## Success Criteria

- `npm run build` succeeds
- Worker handles dynamic routes (`/@:id`, `/get/@:id`, etc.) as before
- `/` serves `index.html` via Static Assets (not Worker)
- `/robots.txt` serves via Static Assets (not Worker)
- Worker bundle size is smaller (no inlined HTML/TXT strings)
