import themes from './data.js';

const DEFAULT_THEME = 'moebooru';
const DIGIT_COUNT = 10;

const validateTheme = (themeId, theme) => {
  if (!theme || typeof theme !== 'object') {
    throw new Error(`Theme "${themeId}" must be an object.`);
  }

  if (!Number.isFinite(theme.width)) {
    throw new Error(`Theme "${themeId}" must define a numeric width.`);
  }

  if (!Number.isFinite(theme.height)) {
    throw new Error(`Theme "${themeId}" must define a numeric height.`);
  }

  if (!Array.isArray(theme.images) || theme.images.length !== DIGIT_COUNT) {
    throw new Error(`Theme "${themeId}" must define exactly ${DIGIT_COUNT} digit images.`);
  }
};

const validateThemes = () => {
  Object.entries(themes).forEach(([themeId, theme]) => validateTheme(themeId, theme));

  if (!themes[DEFAULT_THEME]) {
    throw new Error(`Default theme "${DEFAULT_THEME}" is not registered.`);
  }
};

validateThemes();

const hasTheme = (themeId) => Object.prototype.hasOwnProperty.call(themes, themeId);

const getThemeIds = () => Object.keys(themes);

const getRandomThemeId = () => {
  const themeIds = getThemeIds();
  return themeIds[Math.floor(Math.random() * themeIds.length)];
};

const resolveFallbackThemeId = (fallbackThemeId = DEFAULT_THEME) => (hasTheme(fallbackThemeId) ? fallbackThemeId : DEFAULT_THEME);

const resolveThemeId = (themeId, fallbackThemeId = DEFAULT_THEME) => {
  if (themeId === 'random') {
    return getRandomThemeId();
  }

  if (hasTheme(themeId)) {
    return themeId;
  }

  return resolveFallbackThemeId(fallbackThemeId);
};

const getTheme = (themeId, fallbackThemeId = DEFAULT_THEME) => themes[resolveThemeId(themeId, fallbackThemeId)];

const getThemeOptions = () => getThemeIds().map((id) => ({ id }));

export { DEFAULT_THEME, getTheme, getThemeIds, getThemeOptions, getRandomThemeId, hasTheme, resolveThemeId };
