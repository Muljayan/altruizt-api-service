import knex from 'knex';

const DATABASE = process.env.DB_NAME;
const PASSWORD = process.env.DB_PW;
const USER = process.env.DB_USER;

console.log({
  DATABASE,
  PASSWORD,
  USER,
  env: process.env,
});

const DB = knex({
  client: 'mysql2',
  connection: {
    host: '127.0.0.1',
    user: USER,
    database: DATABASE,
    password: PASSWORD,
  },
});

export default DB;
