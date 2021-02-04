const express = require('express');

const router = express.Router();
const DB = require('../config/database');

router.post('/register', async (req, res) => {
  try {
    const {
      isIndividual, // bool
      userRole,
      email,
      password,
      name,
      description,
      // username,
      address,
      phone,
      website,
      companyRegistrationNumber,
      // categories,
      // categoriesFollowed,
      // resources,
      // logo,

    } = req.body;

    if (!name || !password || !email) {
      return res.status(400).send('Invalid user inputs');
    }

    // It is compulsory for organizations to include the address and phone number
    if (!isIndividual) {
      if (!address || !phone) {
        return res.status(400).send('Invalid user inputs');
      }
    }

    // Company registration number required for companies
    if (userRole === 3) {
      if (!companyRegistrationNumber) {
        return res.status(400).send('Invalid user inputs');
      }
    }
    // Generate a slug for url

    const data = {
      user_role_id: userRole,
      email,
      password,
      name,
      description,
      address,
      contact_number: phone,
      website,
    };

    const user = await DB('users')
      .insert(data);
    console.log(user);

    // TODO handle logo upload in profile section
    return res.status(200).send('successfully added user');
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
