# Quality Guidelines

> Code quality standards for frontend development.

---

## Overview

<!--
Document your project's quality standards here.

Questions to answer:
- What patterns are forbidden?
- What linting rules do you enforce?
- What are your testing requirements?
- What code review standards apply?
-->

(To be filled by the team)

---

## Forbidden Patterns

<!-- Patterns that should never be used and why -->

### Do Not Duplicate Theme Resolution

Theme lookup, fallback, random selection, and raw theme validation must stay in `themes/registry.js`.
Runtime callers such as request handlers and SVG rendering utilities should import registry functions instead of reading the raw theme object directly.

```js
// Wrong: duplicates fallback policy at the call site.
const themeData = themes[theme] || themes.moebooru;

// Correct: uses the central registry contract.
const themeData = getTheme(theme);
```

Why: invalid theme fallback and `theme=random` are request compatibility behavior. Duplicating them in multiple files makes future theme metadata, aliases, hidden themes, or safe-random behavior inconsistent.

---

## Required Patterns

<!-- Patterns that must always be used -->

### Theme Registry Contract

`themes/index.js` is the public registry API for theme consumers. Keep each theme's digit image imports inside `themes/<theme-id>/index.js`, aggregate registered themes in `themes/data.js`, and keep lookup/fallback behavior in `themes/registry.js`.

```js
// themes/moebooru/index.js
import image0 from './0.gif';
// ...import image1 through image9

export default {
  width: 45,
  height: 100,
  images: [image0, image1, image2, image3, image4, image5, image6, image7, image8, image9],
};

// themes/data.js
import moebooru from './moebooru/index.js';

export default {
  moebooru,
};
```

Required exports:

```js
DEFAULT_THEME
getTheme(themeId, fallbackThemeId)
hasTheme(themeId)
getThemeIds(options)
getRandomThemeId(options)
resolveThemeId(themeId, fallbackThemeId, options)
getThemeOptions(options)
```

Validation contract:

- Every registered theme must define numeric `width`.
- Every registered theme must define numeric `height`.
- Every registered theme must define exactly ten digit images.
- `DEFAULT_THEME` must be registered.

Behavior contract:

- `resolveThemeId('random', config.theme)` returns one currently registered theme id.
- Missing or invalid theme ids fall back to the configured theme if valid.
- Missing or invalid configured fallback themes fall back to `DEFAULT_THEME`.
- `getTheme(id)` always returns a usable theme object.

---

## Testing Requirements

<!-- What level of testing is expected -->

(To be filled by the team)

---

## Code Review Checklist

<!-- What reviewers should check -->

(To be filled by the team)
