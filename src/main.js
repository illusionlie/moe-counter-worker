import { Router, error, html, json, text } from 'itty-router';
import config from '../config.yml';
import { getNum, setNum } from './db.js';
import { getCountImage } from './utils.js';
import { validateId } from './middlewares.js';
import indexHtml from './index.html';
import themes from '../themes';
import robots from './robots.txt';

const router = Router();

router.get('/', () => html(indexHtml));
router.get('/favicon.ico', () => error(404));

router.get('/robots.txt', () => text(robots));

router.get('/heart-beat', () => {
  return new Response('alive', {
    headers: {
      'Cache-Control': 'max-age=0, no-cache, no-store, must-revalidate',
    },
  });
});

router.get('/record/@:id', validateId, async (req, env) => {
  const { id } = req.params;

  const num = await getNum(env.DB, id);

  return json({ name: id, num });
});

const counterHandler = async (req, env) => {
  const { id } = req.params;
  let { theme, num, length, padding, ...rest } = req.query;

  if (theme === 'random') {
    const themeNames = Object.keys(themes);
    theme = themeNames[Math.floor(Math.random() * themeNames.length)];
  }

  if (!theme || !themes[theme]) {
    theme = config.theme;
  }

  const customNum = Number(num);
  let count = 0;

  if (id === 'demo') {
    count = '0123456789';
    padding = padding ?? length ?? 10;
  } else if (Number.isInteger(customNum) && customNum > 0 && customNum <= 1e15) {
    count = customNum;
  } else {
    count = await getNum(env.DB, id);
    count += 1;
    await setNum(env.DB, id, count);
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

router.all('*', () => error(404));

export default {
  fetch: (req, ...args) =>
    router
      .handle(req, ...args)
      .then(json)
      .catch(error),
};
