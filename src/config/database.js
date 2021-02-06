const knex = require('knex');

const DATABASE = process.env.DB_NAME;
const PASSWORD = process.env.DB_PW;

const DB = knex({
  client: 'mysql2',
  connection: {
    host: '127.0.0.1',
    user: 'root',
    database: DATABASE,
    password: PASSWORD,
  },
});

module.exports = DB;
