const express = require('express');

const router = express.Router();
const DB = require('../config/database');

router.post('/resources', async (req, res) => {
  try {
    const {
      text,
    } = req.body;

    const fmtText = text.toString().trim().toLowerCase();
    let resources = [];
    if (fmtText) {
      resources = await DB('resources')
        .where('name', 'like', `${fmtText}%`)
        .limit(500);
    }

    return res.status(200).send(resources);
  } catch (err) {
    console.log(err);
    return res.status(400).send('Invalid user inputs');
  }
});

router.post('/login', (req, res) => {
  try {
    return res.status(200).send('Birds home page');
  } catch (err) {
    console.log(err);
    return res.status(400).send('Invalid user inputs');
  }
});

module.exports = router;
