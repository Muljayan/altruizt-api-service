const express = require('express');
const jwt = require('jsonwebtoken');

const router = express.Router();

const DB = require('../config/database');
const { JWT_SECRET } = require('../config/secrets');
const convertToSlug = require('../utils/convertToSlug');

router.post('/register', async (req, res) => {
  // Create transaction object
  const trx = await DB.transaction();
  try {
    const {
      name,
      email,
      userType,
      organizationType,
      password,
      phone,
      address,
      website,
      identificationNumber,
      description,
      categories,
      categoriesFollowed,
      resources,
      // -----------------------
    } = req.body;

    const isAnOrganization = (userType === 'organization');
    const isABeneficiary = (organizationType === 3);
    const isACorporate = (organizationType === 1);

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
    if (isACorporate) {
      if (!identificationNumber) {
        return res.status(400).send({ message: 'Organization\'s identification number is missing!' });
      }
    }

    // Generate a slug for url
    const existingUser = await trx('users')
      .where('email', email)
      .first();

    if (existingUser) {
      return res.status(400).send({ message: 'User already exists!' });
    }

    const userData = {
      user_role_id: isAnOrganization ? 3 : 2,
      email,
      password,
      name,
      description,
      contact_number: phone,
    };

    const userId = await trx('users')
      .insert(userData);

    // categoriesFollowed
    if (categoriesFollowed && categoriesFollowed.length > 0) {
      for await (const categoryFollowed of categoriesFollowed) {
        await trx('categories_followed')
          .insert({ user_id: userId, category_id: categoryFollowed.value });
      }
    }

    if (isAnOrganization) {
      const organizationData = {
        user_id: userId,
        organization_type_id: organizationType,
        is_activated: false,
        address,
        website,
        slug: convertToSlug(`${name}-${userId}`),
        identification_number: identificationNumber,
      };

      const organizationId = await trx('organizations')
        .insert(organizationData);

      // Add resources to list
      // Check if resources available and is an organization
      if (resources && resources.length > 0) {
        for await (const resource of resources) {
          const resourceName = resource.name.toString().trim().toLowerCase();
          const resourceUnit = resource.unit.toString().trim().toLowerCase();
          // check if already available
          const existingResource = await trx('resources')
            .where('name', resourceName)
            .first();
          let resourceId;
          if (!existingResource) {
            // Resource doesnt exist therefore add it
            const insertedResource = await trx('resources')
              .insert({ name: resourceName, unit: resourceUnit });
            resourceId = insertedResource;
          } else {
            // Resource exisits
            resourceId = existingResource.id;
          }
          const resourceListData = {
            organization_id: organizationId,
            resource_id: resourceId,
            quantity: resource.quantity,
          };
          // Charity organizations
          if (isABeneficiary) {
            await trx('resources_needed')
              .insert(resourceListData);
          } else {
            await trx('resources_available')
              .insert(resourceListData);
          }
        }
      }

      // organization categories
      if (categories && categories.length > 0) {
        for await (const category of categories) {
          await trx('organization_categories')
            .insert({ organization_id: organizationId, category_id: category.value });
        }
      }
    }

    trx.commit();
    // TODO handle logo upload in profile section
    return res.status(201).send('successfully added user');
  } catch (err) {
    trx.rollback();
    console.log(err);
    return res.status(400).send({ message: 'invalid user inputs' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const {
      email,
      password,
    } = req.body;

    const user = await DB('users')
      .select('id', 'name', 'email', 'description', 'contact_number as contactNumber')
      .where('email', email)
      .where('password', password)
      .first();

    if (!user) {
      return res.status(401).send({ message: 'your email or password is incorrect' });
    }
    let payload = {
      user,
      organization: null,
      categoriesFollowed: [],
    };

    const categoriesFollowed = await DB('categories_followed as cf')
      .join('categories as c', 'c.id', 'cf.category_id')
      .select('c.id as id', 'c.name as name')
      .where('cf.user_id', user.id);
    if (categoriesFollowed) {
      payload = {
        ...payload,
        categoriesFollowed,
      };
    }

    // Check if organization
    const organization = await DB('organizations as o')
      .select(
        'o.id as id',
        'o.is_activated as isActivated',
        'ot.id as organizationTypeId',
        'ot.name as organizationTypeName',
      )
      .join('organization_types as ot', 'ot.id', 'o.organization_type_id')
      .where('o.user_id', user.id)
      .first();
    if (organization) {
      if (!organization.isActivated) {
        return res.status(401).send({ message: 'organization is not activated, contact the admins' });
      }

      // Get organization categories
      const categories = await DB('organization_categories as oc')
        .join('categories as c', 'c.id', 'oc.category_id')
        .select('c.id as id', 'c.name as name')
        .where('oc.organization_id', organization.id);

      payload = {
        ...payload,
        organization: {
          ...organization,
          categories,
        },
      };
    }

    //  Created jwtToken which Expires in a month
    const jwtToken = jwt.sign(payload, JWT_SECRET, { expiresIn: (60 * 60 * 24 * 30) });
    return res.status(200).send(jwtToken);
  } catch (err) {
    console.log(err);
    return res.status(400).send({ message: 'invalid user inputs' });
  }
});

module.exports = router;
