/* eslint-disable import/prefer-default-export */
import DB from '../config/database';
import { getOrganizationActivationStatus } from '../helpers/organizations';

export const getUnapprovedOrganizations = async (req, res) => {
  try {
    const organizations = await getOrganizationActivationStatus(DB);
    console.log({ organizations });
    return res.status(200).send(organizations);
  } catch (err) {
    console.log(err);
    return res.status(400).send('Invalid user inputs');
  }
};
