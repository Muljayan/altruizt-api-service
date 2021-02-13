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

router.get('/organizers', async (req, res) => {
  try {
    const organizers = await DB('organizations as o')
      .select('o.id as value', 'u.name as label')
      .join('users as u', 'u.id', 'o.user_id')
      .whereIn('organization_type_id', [1, 2]);

    return res.status(200).send(organizers);
  } catch (err) {
    console.log(err);
    return res.status(400).send('Invalid user inputs');
  }
});

router.get('/beneficiaries', async (req, res) => {
  try {
    const beneficiaries = await DB('organizations as o')
      .select('o.id as value', 'u.name as label')
      .join('users as u', 'u.id', 'o.user_id')
      .where('organization_type_id', 3);

    return res.status(200).send(beneficiaries);
  } catch (err) {
    console.log(err);
    return res.status(400).send('Invalid user inputs');
  }
});

router.get('/resources', async (req, res) => {
  try {
    const resources = await DB('resources')
      .select('id as value', 'name as label');

    return res.status(200).send(resources);
  } catch (err) {
    console.log(err);
    return res.status(400).send('Invalid user inputs');
  }
});

module.exports = router;
