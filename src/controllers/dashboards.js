const express = require('express');

const router = express.Router();
const DB = require('../config/database');
const { getOrganizationActivationStatus } = require('../helpers/organizations');

router.get('/approvals', async (req, res) => {
  try {
    const organizations = await getOrganizationActivationStatus(DB);
    console.log({ organizations });
    return res.status(200).send(organizations);
  } catch (err) {
    console.log(err);
    return res.status(400).send('Invalid user inputs');
  }
});

module.exports = router;
