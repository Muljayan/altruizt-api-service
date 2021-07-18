import express from 'express';

import { json } from 'body-parser';
import cors from 'cors';
import helmet from 'helmet';

import routes from './routes';
import { ASSETS_DIRECTORY } from './config/directories';

const app = express();

// Express middlewares
app.use(helmet());
app.use(helmet.contentSecurityPolicy({
  defaultSrc: [
    '*',
    'https://api.altruizt.xyz',
    'https://altruizt.xyz',
  ],
  styleSrc: [
    '\'self\'',
    '\'unsafe-inline\'',
    'https://*.googleapis.com',
    'https://api.altruizt.xyz',
    'https://altruizt.xyz',
  ],
  scriptSrc: [
    '\'self\'',
    '\'unsafe-inline\'',
    'https://api.altruizt.xyz',
    'https://altruizt.xyz',
  ],
  contentSrc: [
    '\'self\'',
    '\'unsafe-inline\'',
    'https://api.altruizt.xyz',
    'https://altruizt.xyz',
  ],
}));
app.use(json({ limit: '10mb' }));
app.use(cors());
app.use(express.static(ASSETS_DIRECTORY));

// Route Setup
app.use('/', routes);

module.exports = app;
