const express = require('express');

const router = express.Router();
const DB = require('../config/database');

router.post('/register', async (req, res) => {
  // Create transaction object
  const trx = await DB.transaction();
  try {
    const {
      userRole,
      name,
      email,
      isAnOrganization,
      isACorporate,
      userType,
      organizationType,
      password,
      phone,
      address,
      website,
      companyRegistrationNumber,
      description,
      categories,
      categoriesFollowed,
      resources,
    } = req.body;

    if (!name || !password || !email) {
      return res.status(400).send({ message: 'Name, password and/or email is missing!' });
    }

    // It is compulsory for organizations to include the address and phone number
    if (isAnOrganization) {
      if (!address || !phone) {
        return res.status(400).send({ message: 'Address and/or Phone number is missing!' });
      }
    }

    // Company registration number required for companies
    if (userRole === 3) {
      if (!companyRegistrationNumber) {
        return res.status(400).send({ message: 'Company registration number is missing!' });
      }
    }

    // Generate a slug for url
    const existingUser = await trx('users')
      .where('email', email)
      .first();

    if (existingUser) {
      return res.status(400).send({ message: 'User already exists!' });
    }

    const data = {
      user_role_id: isAnOrganization ? organizationType.value : 2,
      email,
      password,
      // Activate only individual accounts
      is_activated: !isAnOrganization,
      name,
      description,
      address,
      contact_number: phone,
      website,
      company_registration_number: companyRegistrationNumber,
    };

    const userId = await trx('users')
      .insert(data);

    // Add resources to list
    // Check if resources available and is an organization
    if (isAnOrganization && (resources && resources.length > 0)) {
      // eslint-disable-next-line no-restricted-syntax
      for await (const resource of resources) {
        const resourceName = resource.name.toString().trim().toLowerCase();
        const resourceUnit = resource.unit.toString().trim().toLowerCase();
        // check if already available
        const existingResource = await trx('resources')
          .where('name', resourceName)
          .first();
        let resourceId;
        if (existingResource && existingResource.length === 0) {
          // resource doesnt exist therefore add it
          const insertedResource = await trx('resources')
            .insert({ name: resourceName, unit: resourceUnit });
          resourceId = insertedResource;
        } else {
          resourceId = existingResource.id;
        }
        const resourceListData = {
          user_id: userId,
          resource_id: resourceId,
          quantity: resource.quantity,
        };
        // Charity organizations
        if (organizationType.value === 4) {
          await trx('needs_list')
            .insert(resourceListData);
        } else {
          await trx('resources_list')
            .insert(resourceListData);
        }
      }
    }

    trx.commit();
    // TODO handle logo upload in profile section
    return res.status(200).send('successfully added user');
  } catch (err) {
    trx.rollback();
    console.log(err);
    return res.status(400).send({ message: 'Invalid user inputs' });
  }
});

router.post('/login', (req, res) => {
  try {
    return res.status(200).send('Birds home page');
  } catch (err) {
    console.log(err);
    return res.status(400).send({ message: 'Invalid user inputs' });
  }
});

module.exports = router;
