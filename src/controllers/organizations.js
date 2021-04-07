import DB from '../config/database';
import { getEventsPreviewData } from '../helpers/events';
import { getOrganizationActivationStatus } from '../helpers/organizations';
import extractToken from '../utils/extractToken';

// router.post('/', async (req, res) => {
export const searchOrganizations = async (req, res) => {
  const { searchString, isBeneficiary, resources } = req.body;

  const searchedResources = resources.map((resource) => resource.value);

  try {
    const organizationsQuery = DB('organizations as o')
      .join('users as u', 'u.id', 'o.user_id')
      .select('o.id as id', 'u.name as name', 'u.image as image')
      .where('is_activated', true)
      .groupBy('o.id');

    if (isBeneficiary) {
      organizationsQuery
        .leftJoin('resources_needed as r', 'r.organization_id', 'o.id')
        .where('organization_type_id', 3);
    } else {
      // Resources available
      organizationsQuery
        .leftJoin('resources_available as r', 'r.organization_id', 'o.id')
        .whereNot('organization_type_id', 3);
    }

    if (searchString) {
      organizationsQuery
        .where('u.name', 'like', `%${searchString}%`);
    }

    if (searchedResources.length > 0) {
      organizationsQuery
        .whereIn('r.resource_id', searchedResources);
    }

    const organizations = await organizationsQuery;

    const responseData = [];

    for await (const organization of organizations) {
      const categories = await DB('organization_categories as oc')
        .select('c.id as id', 'c.name as name')
        .join('categories as c', 'c.id', 'oc.category_id')
        .where('organization_id', organization.id);

      responseData.push({
        ...organization,
        categories,
      });
    }

    return res.status(200).send(responseData);
  } catch (err) {
    console.log(err);
    return res.status(500).send('Something went wrong');
  }
};

// router.get('/profile/:id', );
export const getOrganizationProfile = async (req, res) => {
  const tokenData = extractToken(req);
  const { id } = req.params;
  const allowable = (tokenData && tokenData.isSuperAdmin)
    || (tokenData && tokenData.organization && tokenData.organization.id === id);
  try {
    const organizationQuery = DB('organizations as o')
      .select(
        'u.name as name', 'u.description as description', 'u.contact_number as phone', 'u.image as image',
        'o.address as address', 'o.website as website', 'o.identification_number as identificationNumber',
        'o.organization_type_id as type',
      )
      .join('users as u', 'u.id', 'o.user_id')

      .where('o.id', id)
      .first();
    if (!allowable) {
      organizationQuery
        .where('is_activated', true);
    }

    const organization = await organizationQuery;

    if (!organization) {
      return res.status(404).send('Not found');
    }

    let resources = [];
    const currentEvents = [];
    const pastEvents = [];

    const eventQuery = DB('events as e')
      .select(
        'e.id', 'e.title', 'e.main_organizer_id as mainOrganizer',
      )
      .groupBy('e.id')
      .where('e.is_active', true);

    // Beneficiaries
    if (organization.type === 3) {
      resources = await DB('resources_needed as rn')
        .select('r.id as id', 'r.name as name', 'r.unit as unit', 'rn.quantity as quantity')
        .join('resources as r', 'r.id', 'rn.resource_id')
        .where('rn.organization_id', id);

      // join beneficiaries and search
      eventQuery
        .join('event_beneficiaries as eb', 'eb.event_id', 'e.id')
        .where('eb.organization_id', id);
    } else {
      resources = await DB('resources_available as ra')
        .select('r.id as id', 'r.name as name', 'r.unit as unit', 'ra.quantity as quantity')
        .join('resources as r', 'r.id', 'ra.resource_id')
        .where('ra.organization_id', id);
      // Join
      eventQuery
        .join('event_organizers as eo', 'eo.event_id', 'e.id')
        .where('eo.organization_id', id)
        .orWhere('e.main_organizer_id', id);
    }

    const currentEventList = await eventQuery
      .where('e.is_complete', false);
    for await (const event of currentEventList) {
      const eventData = await getEventsPreviewData(event, DB);
      currentEvents.push(eventData);
    }
    const pastEventList = await eventQuery
      .where('e.is_complete', true);
    for await (const event of pastEventList) {
      const eventData = await getEventsPreviewData(event, DB);
      pastEvents.push(eventData);
    }

    const responseData = {
      // categories
      ...organization,
      resources,
      currentEvents,
      pastEvents,
    };
    return res.status(200).send(responseData);
  } catch (err) {
    console.log(err);
    return res.status(500).send('Something went wrong');
  }
};

// router.put('/profile/:id/toggle-activation-status', );
export const toggleActivationStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const organization = await DB('organizations')
      .select('is_activated as isActivated')
      .where('id', id)
      .first();

    await DB('organizations')
      .update({ is_activated: !organization.isActivated })
      .where('id', id);
    const responseData = await getOrganizationActivationStatus(DB);
    return res.status(200).send(responseData);
  } catch (err) {
    console.log(err);
    return res.status(500).send('Something went wrong');
  }
};

export const getIndividuals = async (req, res) => {
  try {
    const responseObj = {};
    return res.status(500).send(responseObj);
  } catch (err) {
    console.log(err);
    return res.status(500).send('Something went wrong');
  }
};

export const getCorporates = async (req, res) => {
  try {
    const responseObj = {};
    return res.status(500).send(responseObj);
  } catch (err) {
    console.log(err);
    return res.status(500).send('Something went wrong');
  }
};

export const getVolunteerOrganizations = async (req, res) => {
  try {
    const responseObj = {};
    return res.status(500).send(responseObj);
  } catch (err) {
    console.log(err);
    return res.status(500).send('Something went wrong');
  }
};

export const getBeneficiaries = async (req, res) => {
  try {
    const responseObj = {};
    return res.status(500).send(responseObj);
  } catch (err) {
    console.log(err);
    return res.status(500).send('Something went wrong');
  }
};

export const getEvents = async (req, res) => {
  try {
    const responseObj = {};
    return res.status(500).send(responseObj);
  } catch (err) {
    console.log(err);
    return res.status(500).send('Something went wrong');
  }
};
