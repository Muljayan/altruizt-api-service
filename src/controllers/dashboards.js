import DB from '../config/database';
import { getOrganizationActivationStatus } from '../helpers/organizations';
import extractToken from '../utils/extractToken';

export const getUnapprovedOrganizations = async (req, res) => {
  try {
    const organizations = await getOrganizationActivationStatus(DB);
    return res.status(200).send(organizations);
  } catch (err) {
    console.log(err);
    return res.status(400).send('Invalid user inputs');
  }
};

export const getIndividuals = async (req, res) => {
  try {
    const individuals = await DB('users')
      .select('name', 'email', 'contact_number as phone', 'description')
      .where('user_role_id', 2);
    return res.status(200).send(individuals);
  } catch (err) {
    console.log(err);
    return res.status(500).send('Something went wrong');
  }
};

export const getOrganizationByType = async (req, res) => {
  const { type } = req.params;
  let typeId = 0;
  switch (type) {
    case 'corporates':
      typeId = 1;
      break;
    case 'volunteer-organizations':
      typeId = 2;
      break;
    case 'beneficiaries':
      typeId = 3;
      break;
    default:
      break;
  }
  try {
    const organizations = await DB('organizations as o')
      .select(
        'o.id as id', 'u.name as name', 'u.email as email', 'u.contact_number as phone', 'u.description as description',
        'o.address as address', 'o.identification_number as identificationNumber', 'o.is_activated as isActivated',
      )
      .join('users as u', 'u.id', 'o.user_id')
      .where('o.organization_type_id', typeId)
      .where('is_activated', true);
    return res.status(200).send(organizations);
  } catch (err) {
    console.log(err);
    return res.status(500).send('Something went wrong');
  }
};

// Only organizations and super admins
export const getEvents = async (req, res) => {
  // Currently only main organization has access to this.
  const tokenData = extractToken(req);
  try {
    const eventQuery = DB('events as e')
      .join('organizations as o', 'o.id', 'e.main_organizer_id')
      .join('users as u', 'u.id', 'o.user_id')
      .select(
        'e.id as id',
        'e.title as title',
        'e.is_active as isActive',
        'e.is_complete as isComplete',
        'u.name as mainOrganizer',
      )
      .groupBy('e.id');

    if (tokenData && tokenData.organization) {
      eventQuery
        .join('event_organizers as eo', 'eo.event_id', 'e.id')
        .where('o.id', tokenData.organization.id)
        .orWhere('eo.organization_id', tokenData.organization.id);
    }

    const events = await eventQuery;
    for await (const event of events) {
      const pledgesCount = await DB('event_pledges')
        .count('id as count')
        .where('event_id', event.id)
        .first();
      console.log({ pledgesCount });
    }
    /*
    Name
    Main Organizer => Link to organizer
    Completion Status
    Followers
    Pledges Count
    Rating
    Active Status => only super admin
    View
    */
    // const responseObj = {};
    return res.status(200).send(events);
  } catch (err) {
    console.log(err);
    return res.status(500).send('Something went wrong');
  }
};
