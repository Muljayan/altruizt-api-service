const dotenv = require('dotenv');

dotenv.config();

const requireESM = require('esm')(module);

const app = requireESM('./app');

const PORT = process.env.PORT || 8081;

app.listen(PORT, () => {
  console.log(`App is running on http://localhost:${PORT}`);
});
