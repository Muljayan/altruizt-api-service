const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const authRoutes = require('./routes/auth');
const autocompleteRoutes = require('./routes/autocomplete');

// Read env variables

const app = express();

const { PORT } = process.env;

// Express middlewares
app.use(bodyParser.json({ limit: '10mb' }));
app.use(cors());

app.get('/', (req, res) => res.status(200).send({ works: true }));

// Route Setup
app.use('/auth', authRoutes);
app.use('/autocomplete', autocompleteRoutes);

app.listen(PORT, () => {
  console.log(`App is running on http://localhost:${PORT}`);
});
