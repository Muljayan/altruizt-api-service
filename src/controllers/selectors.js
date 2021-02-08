const express = require('express');

const router = express.Router();
const DB = require('../config/database');

router.get('/categories', async (req, res) => {
  try {
    const categories = await DB('categories')
      .select('id as value', 'name as label');

    return res.status(200).send(categories);
  } catch (err) {
    console.log(err);
    return res.status(400).send({ message: 'Invalid user inputs' });
  }
});

router.get('/organization-types', async (req, res) => {
  try {
    const categories = await DB('organization_types')
      .select('id as value', 'name as label');

    return res.status(200).send(categories);
  } catch (err) {
    console.log(err);
    return res.status(400).send({ message: 'Invalid user inputs' });
  }
});

module.exports = router;
