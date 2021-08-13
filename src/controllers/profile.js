import { promises as fs } from 'fs';
import bcrypt from 'bcryptjs';

import DB from '../config/database';
import { USER_IMAGE_DIRECTORY } from '../config/directories';
import convertToSlug from '../utils/convertToSlug';
import extractToken from '../utils/extractToken';
import { imageExtractor } from '../utils/extractors';

// router.get('/',);
export const getProfile = async (req, res) => {
  const tokenData = extractToken(req);
  const { user: u, organization: o } = tokenData;
  try {
    const user = await DB('users')
      .select('id', 'name', 'email', 'description', 'contact_number as phone', 'image')
      .where('id', u.id)
      .first();

    let organization = {
      address: '',
      website: '',
      identificationNumber: '',
    };
    let organizationType = null;
    let resources = [];
    let categories = [];
    let categoriesFollowed = [];
    if (o) {
      organization = await DB('organizations')
        .select('organization_type_id as organizationType', 'address', 'website', 'identification_number as identificationNumber')
        .where('id', o.id)
        .first();
      organizationType = await DB('organization_types')
        .select('id as value', 'name as label')
        .where('id', organization.organizationType)
        .first();

      categories = await DB('organization_categories as oc')
        .select('c.name as label', 'c.id as value')
        .join('categories as c', 'c.id', 'oc.category_id')
        .where('oc.organization_id', o.id);

      if (organizationType.value === 3) {
        // resources needed
        resources = await DB('resources_needed as rn')
          .select('r.name as name', 'r.unit as unit', 'rn.quantity as quantity')
          .join('resources as r', 'r.id', 'rn.resource_id')
          .where('rn.organization_id', o.id);
      } else {
        // resources available
        resources = await DB('resources_available as ra')
          .select('r.name as name', 'r.unit as unit', 'ra.quantity as quantity')
          .join('resources as r', 'r.id', 'ra.resource_id')
          .where('ra.organization_id', o.id);
      }
    }

    categoriesFollowed = await DB('categories_followed as cf')
      .leftJoin('categories as c', 'c.id', 'cf.category_id')
      .select('c.name as label', 'c.id as value')
      .where('cf.user_id', u.id);

    let userType = { value: 'individual', label: 'Individual' };
    if (o) {
      userType = { value: 'organization', label: 'Organization' };
    }

    const responseObject = {
      ...user,
      ...organization,
      userType,
      organizationType,
      categories,
      categoriesFollowed,
      resources,
    };
    return res.status(201).send(responseObject);
  } catch (err) {
    console.log(err);
    return res.status(400).send({ message: 'invalid user inputs' });
  }
};

export const editProfile = async (req, res) => {
  const tokenData = extractToken(req);
  const { user: u, organization: o } = tokenData;
  // Create transaction object
  const trx = await DB.transaction();
  try {
    const {
      image,
      name,
      email,
      password,
      phone,
      address,
      website,
      identificationNumber,
      description,
      categories,
      categoriesFollowed,
      resources,
    } = req.body;
    const isAnOrganization = !!o;
    const isABeneficiary = (isAnOrganization && (o.organizationTypeId === 3));
    const isACorporate = (isAnOrganization && (o.organizationTypeId === 1));

    if (!name || !email) {
      trx.rollback();
      return res.status(400).send({ message: 'Name and/or email is missing!' });
    }

    // It is compulsory for organizations to include the address and phone number
    if (isAnOrganization) {
      if (!address || !phone) {
        trx.rollback();
        return res.status(400).send({ message: 'Address and/or Phone number is missing!' });
      }
    }

    // Company registration number required for companies
    if (isACorporate) {
      if (!identificationNumber) {
        trx.rollback();
        return res.status(400).send({ message: 'Organization\'s identification number is missing!' });
      }
    }
    const dbUser = await trx('users')
      .where('id', u.id)
      .select('email')
      .first();

    if (dbUser.email !== email) {
      // Generate a slug for url
      const existingUser = await trx('users')
        .where('email', email)
        .first();

      if (existingUser) {
        trx.rollback();
        return res.status(400).send({ message: 'User already exists!' });
      }
    }

    const userData = {
      email,
      name,
      description,
      contact_number: phone,
    };

    if (password) {
      const salt = bcrypt.genSaltSync(10);
      const hashedPassword = bcrypt.hashSync(password, salt);
      userData.password = hashedPassword;
    }

    await trx('users')
      .update(userData)
      .where('id', u.id);
    await trx('categories_followed')
      .where('user_id', u.id)
      .delete();
    // categoriesFollowede
    if (categoriesFollowed && categoriesFollowed.length > 0) {
      for await (const categoryFollowed of categoriesFollowed) {
        await trx('categories_followed')
          .insert({ user_id: u.id, category_id: categoryFollowed.value });
      }
    }

    if (isAnOrganization) {
      const organizationData = {
        address,
        website,
        slug: convertToSlug(`${name}-${u.id}`),
        identification_number: identificationNumber,
      };

      await trx('organizations')
        .update(organizationData)
        .where('id', o.id);

      if (isABeneficiary) {
        await trx('resources_needed')
          .where('organization_id', o.id)
          .delete();
      } else {
        await trx('resources_available')
          .where('organization_id', o.id)
          .delete();
      }
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
            organization_id: o.id,
            resource_id: resourceId,
            quantity: Number(resource.quantity),
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

      await trx('organization_categories')
        .where('organization_id', o.id)
        .delete();
      // organization categories
      if (categories && categories.length > 0) {
        for await (const category of categories) {
          await trx('organization_categories')
            .insert({ organization_id: o.id, category_id: category.value });
        }
      }
    }
    if (image && image.value) {
      const { extension, fmtImg } = imageExtractor(image);

      try {
        const userImage = await trx('users')
          .select('image')
          .where('id', u.id);

        const currentImageLocation = `${USER_IMAGE_DIRECTORY}/${userImage.image}`;

        await fs.stat(currentImageLocation);
        await fs.unlink(currentImageLocation);
      } catch (err) {
        console.log('file does not exist for user');
      }
      const imageName = `${u.id}.${extension}`;

      const imagePath = `${USER_IMAGE_DIRECTORY}/${imageName}`;
      await fs.writeFile(imagePath, fmtImg, 'base64');

      await trx('users')
        .where('id', u.id)
        .update({ image: imageName });
    }

    trx.commit();
    return res.status(201).send({ message: 'successfully updated user' });
  } catch (err) {
    trx.rollback();
    console.log(err);
    return res.status(400).send({ message: 'invalid user inputs' });
  }
};

// router.get('/sidebar', );
export const getSidebar = async (req, res) => {
  const tokenData = extractToken(req);
  let user = null;
  if (tokenData) {
    user = tokenData.user;
  }
  try {
    const categoryQuery = DB('categories as c')
      .join('categories_followed as cf', 'cf.category_id', 'c.id')
      .select('c.id', 'c.name')
      // .where('cf.user_id', user.id)
      .groupBy('c.id');

    if (user && user.id) {
      categoryQuery
        .where('cf.user_id', user.id);
    }
    const categories = await categoryQuery;

    const suggestions = [];

    for await (const category of categories) {
      const events = await DB('events as e')
        .select('e.id as id', 'e.title as name', 'e.image as image')
        .join('event_categories as ec', 'ec.event_id', 'e.id')
        .where('ec.category_id', category.id);
      if (events && events.length > 0) {
        suggestions.push({ ...category, events });
      }
    }

    const responseData = {
      categories,
      suggestions,
    };

    return res.status(201).send(responseData);
  } catch (err) {
    console.log(err);
    return res.status(400).send({ message: 'invalid user inputs' });
  }
};
