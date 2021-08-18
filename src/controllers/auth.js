import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';

import DB from '../config/database';
import { JWT_SECRET } from '../config/secrets';
import convertToSlug from '../utils/convertToSlug';
import sendEmail from '../utils/email';

/**
 * @route POST /auth/register
 * @description Register User
 * @access   Public
 */
export const register = async (req, res) => {
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
      trx.rollback();
      return res.status(400).send({ message: 'Name, password and/or email is missing!' });
    }

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

    // Generate a slug for url
    const existingUser = await trx('users')
      .where('email', email)
      .first();

    if (existingUser) {
      trx.rollback();
      return res.status(400).send({ message: 'User already exists!' });
    }

    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(password, salt);
    const userData = {
      user_role_id: isAnOrganization ? 3 : 2,
      email,
      password: hashedPassword,
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

    const emailMessage = !isAnOrganization ? 'Congratulations! Your Altruizt account is created!' : 'Thank you for registering with Altruizt, your account is under review';

    await sendEmail(email, 'Altruizt Account Creation', emailMessage);

    trx.commit();
    return res.status(201).send({ message: 'successfully added user' });
  } catch (err) {
    trx.rollback();
    console.log(err);
    return res.status(400).send({ message: 'invalid user inputs' });
  }
};

/**
 * @route POST /auth/reset-token
 * @description Get password reset token
 * @access   Public
 */
export const getResetToken = async (req, res) => {
  // Create transaction object
  const trx = await DB.transaction();
  try {
    const {
      email,
    } = req.body;

    // Generate a slug for url
    const existingUser = await trx('users')
      .where('email', email)
      .first();

    if (!existingUser) {
      trx.rollback();
      return res.status(400).send({ message: 'User does not exists!' });
    }

    const salt = bcrypt.genSaltSync(10);
    const hashedToken = bcrypt.hashSync(uuid(), salt);
    console.log({ hashedToken, email, id: existingUser.id });
    const userData = {
      reset_token: hashedToken,
    };
    await trx('users')
      .update(userData)
      .where('id', existingUser.id);

    const emailMessage = `Your reset token is ${hashedToken}`;

    await sendEmail(email, 'Altruizt Password Reset Token', emailMessage);

    trx.commit();
    return res.status(201).send({ message: 'Password reset token sent' });
  } catch (err) {
    trx.rollback();
    console.log(err);
    return res.status(400).send({ message: 'invalid user inputs' });
  }
};

/**
 * @route POST /auth/reset-password
 * @description Reset Password
 * @access   Public
 */
export const resetPassword = async (req, res) => {
  // Create transaction object
  const trx = await DB.transaction();
  try {
    const {
      email,
      password,
      resetToken,
    } = req.body;

    // Generate a slug for url
    const existingUser = await trx('users')
      .where('email', email)
      .first();

    if (!existingUser) {
      trx.rollback();
      return res.status(400).send({ message: 'User does not exists!' });
    }

    if (existingUser && !existingUser.reset_token) {
      trx.rollback();
      return res.status(400).send({ message: 'Warning! You cannot change the password' });
    }
    if (existingUser && (existingUser.reset_token !== resetToken)) {
      trx.rollback();
      return res.status(400).send({ message: 'Warning! Invalid reset token, please check your email' });
    }

    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(password, salt);
    const userData = {
      reset_token: null,
      password: hashedPassword,
    };
    await trx('users')
      .update(userData)
      .where('email', email);

    const message = 'Your password has been reset!';

    await sendEmail(email, 'Altruizt Password Reset', message);

    trx.commit();
    return res.status(201).send({ message });
  } catch (err) {
    trx.rollback();
    console.log(err);
    return res.status(400).send({ message: 'invalid user inputs' });
  }
};

/**
 * @route POST /auth/login
 * @description Login User
 * @access   Public
 */
export const login = async (req, res) => {
  try {
    const {
      email,
      password,
    } = req.body;

    const user = await DB('users')
      .select(
        'id', 'name', 'email',
        'description', 'contact_number as contactNumber',
        'password', 'user_role_id as userRole',
      )
      .where('email', email)
      .first();

    if (!user) {
      return res.status(401).send({ message: 'No user found!' });
    }

    const passwordMatch = bcrypt.compareSync(password, user.password);

    if (!passwordMatch) {
      return res.status(401).send({ message: 'Invalid password' });
    }

    let payload = {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        description: user.description,
        contactNumber: user.contactNumber,
      },
      isSuperAdmin: !!(user.userRole === 1),
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
};
