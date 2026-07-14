import { Router, json } from 'itty-router';
import config from '../config.yml';
import { getNum, setNum } from './db.js';
import { getCountImage } from './utils.js';
import { withRequestTracing, withResponseLogging, validateId } from './middlewares.js';
import { resolveThemeId } from '../themes/index.js';
import { handleError } from './errors.js';
import { createLogger } from './logger.js';

const router = Router({
  before: [withRequestTracing],
  finally: [withResponseLogging],
});

router.get('/favicon.ico', () => new Response(null, { status: 404 }));

router.get('/heart-beat', () => {
  return new Response('alive', {
    headers: {
      'Cache-Control': 'max-age=0, no-cache, no-store, must-revalidate',
    },
  });
});

router.get('/record/@:id', validateId, async (req, env) => {
  const { id } = req.params;

  const num = await getNum(env.DB, id, req.logger);

  return json({ name: id, num });
});

const counterHandler = async (req, env) => {
  const { id } = req.params;
  const { num, length, theme: rawTheme, padding: rawPadding, ...rest } = req.query;
  let theme = rawTheme;
  let padding = rawPadding;

  theme = resolveThemeId(theme, config.theme);

  const customNum = Number(num);
  let count = 0;

  if (id === 'demo') {
    count = '0123456789';
    padding = padding ?? length ?? 10;
  } else if (Number.isInteger(customNum) && customNum > 0 && customNum <= 1e15) {
    count = customNum;
  } else {
    count = await getNum(env.DB, id, req.logger);
    count += 1;
    await setNum(env.DB, id, count, req.logger);

    if (req.logger) {
      req.logger.debug('Counter incremented', { counterId: id, newValue: count });
    }
  }

  const image = getCountImage({
    count,
    theme,
    padding: padding ?? length ?? config.length,
    ...rest,
  });

  return new Response(image, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': id === 'demo' ? 'public, max-age=31536000' : 'max-age=0, no-cache, no-store, must-revalidate',
    },
  });
};

router.get('/@:id', validateId, counterHandler);
router.get('/get/@:id', validateId, counterHandler);

router.all('*', () => new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Not Found' } }), {
  status: 404,
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
}));

export default {
  fetch: (req, ...args) => {
    // 创建一个 fallback logger 用于路由级别之外的错误
    const fallbackLogger = createLogger({ phase: 'router' });

    return router
      .fetch(req, ...args)
      .catch((err) => handleError(err, req.logger || fallbackLogger));
  },
};
