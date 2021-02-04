const express = require('express');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');

dotenv.config();

const authControllers = require('./controllers/auth');

// Read env variables

const app = express();

const { PORT } = process.env;

// Express middlewares
app.use(bodyParser.json({ limit: '10mb' }));

app.get('/', (req, res) => res.status(200).send({ works: true }));

// Route Setup
app.use('/auth', authControllers);

app.listen(PORT, () => {
  console.log(`App is running on http://localhost:${PORT}`);
});
