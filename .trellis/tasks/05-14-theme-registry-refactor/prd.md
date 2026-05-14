# Refactor Theme Registry

## Goal

Centralize theme lookup, fallback, random selection, and validation behind a stable registry API while preserving existing request compatibility and generated SVG behavior.

## MVP Scope

- Add a registry API around the existing theme image data.
- Move raw theme data into a separate module to avoid circular imports.
- Keep `themes/index.js` as the public facade.
- Update `src/main.js` to resolve requested theme ids through the registry.
- Update `src/utils.js` to fetch usable theme data through the registry.
- Preserve current `theme=random` behavior, including all existing themes.
- Preserve fallback behavior for missing or invalid theme names.
- Do not change homepage static theme lists in this pass.
- Do not introduce new theme asset conventions or automatic glob loading.

## Compatibility Requirements

Existing URLs must continue to work:

- `/@demo?theme=asoul`
- `/@demo?theme=moebooru`
- `/@demo?theme=moebooru-h`
- `/@demo?theme=rule34`
- `/@demo?theme=gelbooru`
- `/@demo?theme=gelbooru-h`
- `/@demo?theme=random`

Invalid theme names should fall back to configured theme, then to `moebooru`.

## Implementation Notes

- Use `themes/data.js` for raw imported theme image data.
- Use `themes/registry.js` for `DEFAULT_THEME`, validation, lookup, random selection, and options.
- Use `themes/index.js` to re-export registry APIs and preserve a default raw data export for compatibility.
- Validation should fail fast when a theme lacks numeric `width`, numeric `height`, or exactly ten images.
- Keep `getCountImage(count, theme, length, pixelated)` signature stable.

## Verification

- Run `npm run build`.
- There are no configured lint, test, or typecheck scripts.

## Deferred Follow-Ups

- Add metadata such as `label`, `nsfw`, `hidden`, and `aliases`.
- Split themes into per-theme image modules.
- Add a `/themes` API and dynamically hydrate homepage options.
- Add an explicit safe random mode if NSFW themes should be excluded.
