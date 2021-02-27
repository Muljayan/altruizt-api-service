import express from 'express';

import { json } from 'body-parser';
import cors from 'cors';

import routes from './routes';

const app = express();

// Express middlewares
app.use(json({ limit: '10mb' }));
app.use(cors());

// Route Setup
app.use('/', routes);

module.exports = app;
