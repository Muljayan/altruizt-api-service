import express from 'express';

import { json } from 'body-parser';
import cors from 'cors';
import helmet from 'helmet';

import routes from './routes';
import { ASSETS_DIRECTORY } from './config/directories';

const app = express();

// Express middlewares
app.use(helmet());
app.use(json({ limit: '10mb' }));
app.use(cors());
app.use(express.static(ASSETS_DIRECTORY));

// Route Setup
app.use('/', routes);

module.exports = app;
