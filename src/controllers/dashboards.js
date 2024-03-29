import DB from '../config/database';
import { getOrganizationActivationStatus } from '../helpers/organizations';
// import {  } from '../middleware/authenticate';
import extractToken from '../utils/extractToken';

export const getDashboardData = async (req, res) => {
  const tokenData = extractToken(req);

  const { isSuperAdmin, organization, user } = tokenData;
  const isOrganization = !!(organization && organization.id);
  const u = await DB('users', 'image')
    .select('name')
    .where('id', user.id)
    .first();
  try {
    let superAdminData = null;
    if (isSuperAdmin) {
      // SUPER ADMIN
      const individuals = await DB('users')
        .count('id as count')
        .where('user_role_id', 2)
        .first();
      const approvals = await DB('organizations')
        .count('id as count')
        .where('is_activated', false)
        .first();
      const corporates = await DB('organizations')
        .count('id as count')
        .where('organization_type_id', 1)
        .first();
      const volunteerOrganizations = await DB('organizations')
        .count('id as count')
        .where('organization_type_id', 2)
        .first();
      const beneficiaries = await DB('organizations')
        .count('id as count')
        .where('organization_type_id', 3)
        .first();
      const events = await DB('events')
        .count('id as count')
        .first();
      const resources = await DB('resources')
        .count('id as count')
        .first();
      const categories = await DB('categories')
        .count('id as count')
        .first();
      superAdminData = {
        individuals: individuals.count,
        approvals: approvals.count,
        corporates: corporates.count,
        volunteerOrganizations: volunteerOrganizations.count,
        beneficiaries: beneficiaries.count,
        events: events.count,
        resources: resources.count,
        categories: categories.count,
      };
    }
    // YOUR ACTIVITIES
    const eventsFollowed = await DB('event_followers')
      .where('user_id', user.id)
      .count('id as count')
      .first();
    const eventsPledged = await DB('event_pledges')
      .where('user_id', user.id)
      .count('id as count')
      .first();

    const yourActivities = {
      eventsFollowed: eventsFollowed.count,
      eventsPledged: eventsPledged.count,
    };

    let yourOrganization = null;

    if (isOrganization) {
      // total events, events completed, events in progress, total pledges
      const allEvents = await DB('events as e')
        .leftJoin('event_organizers as eo', 'eo.event_id', 'e.id')
        .select('e.title', 'e.id as id', 'e.is_complete as isComplete', 'e.is_successful as isSuccessful')
        .groupBy('e.id')
        .where(function () {
          this.where('e.main_organizer_id', tokenData.organization.id).orWhere('eo.organization_id', tokenData.organization.id);
        });

      let totalEvents = 0;
      let completedEvents = 0;
      let successfulEvents = 0;
      let totalPledges = 0;
      let totalRatings = 0;
      let totalRatingValue = 0;
      let highestRatedEvent = null;
      if (allEvents) {
        for await (const event of allEvents) {
          totalEvents += 1;
          if (event.isComplete) {
            completedEvents += 1;
            if (event.isSuccessful) {
              successfulEvents += 1;
            }
          }
          const pledges = await DB('event_pledges')
            .count('id as count')
            .where('event_id', event.id)
            .first();
          const ratings = await DB('event_ratings')
            .count('id as count')
            .where('event_id', event.id)
            .first();
          const ratingsValue = await DB('event_ratings')
            .sum('value as value')
            .where('event_id', event.id)
            .first();
          totalPledges += (pledges ? pledges.count : 0);
          totalRatings += (ratings ? ratings.count : 0);
          totalRatingValue += (ratingsValue ? Number(ratingsValue.value) : 0);
          const ratingValue = ratingsValue ? Number(ratingsValue.value) : 0;
          if (!highestRatedEvent) {
            highestRatedEvent = {
              ...event,
              ratingValue: (ratingsValue ? Number(ratingsValue.value) : 0),
            };
          } else if (highestRatedEvent.ratingValue < ratingValue) {
            highestRatedEvent = {
              ...event,
              ratingValue,
            };
          }
        }
      }

      let resourcesNeeded = [];
      let resourcesAvailable = [];
      let eventsBenefitted = null;

      if (organization.organizationTypeId === 3) {
        // resources needed
        resourcesNeeded = await DB('resources_needed as rn')
          .select('r.id', 'r.name as name', 'r.unit as unit', 'rn.quantity as quantity')
          .join('resources as r', 'r.id', 'rn.resource_id')
          .where('rn.organization_id', organization.id);
        eventsBenefitted = await DB('events as e')
          .count('e.id as count')
          .leftJoin('event_beneficiaries as eb', 'eb.event_id', 'e.id')
          .where('eb.organization_id', organization.id)
          .first();
      } else {
        // resources available
        resourcesAvailable = await DB('resources_available as ra')
          .select('r.id', 'r.name as name', 'r.unit as unit', 'ra.quantity as quantity')
          .join('resources as r', 'r.id', 'ra.resource_id')
          .where('ra.organization_id', organization.id);
      }

      let suggestions = [];

      // Non beneficiaries
      if (resourcesAvailable.length > 0) {
        const resourcesAvailableArr = resourcesAvailable.map((r) => r.id);
        suggestions = await DB('organizations as o')
          .join('users as u', 'u.id', 'o.user_id')
          .join('resources_needed as rn', 'rn.organization_id', 'o.id')
          .join('resources as r', 'r.id', 'rn.resource_id')
          .select('o.id as id', 'u.name as name', 'u.image as image')
          .whereIn('rn.resource_id', resourcesAvailableArr)
          .orderByRaw('RAND()')
          .groupBy('o.id')
          .limit(15);
      }

      if (resourcesNeeded.length > 0) {
        const resourcesNeededArr = resourcesNeeded.map((r) => r.id);
        suggestions = await DB('organizations as o')
          .join('users as u', 'u.id', 'o.user_id')
          .join('resources_available as ra', 'ra.organization_id', 'o.id')
          .join('resources as r', 'r.id', 'ra.resource_id')
          .select('o.id as id', 'u.name as name', 'u.image as image')
          .whereIn('ra.resource_id', resourcesNeededArr)
          .orderByRaw('RAND()')
          .groupBy('o.id')
          .limit(15);
      }
      yourOrganization = {
        totalEvents,
        eventsBenefitted: eventsBenefitted ? eventsBenefitted.count : 0,
        completedEvents,
        totalPledges,
        successfulEvents,
        totalRatings,
        totalRatingValue,
        highestRatedEvent,
        resourcesNeeded: resourcesNeeded || [],
        resourcesAvailable: resourcesAvailable || [],
        organizationType: organization.organizationTypeId,
        suggestions,
      };
    }

    const responseObj = {
      user: {
        id: user.id,
        name: u.name,
        image: u.image,
      },
      superAdmin: superAdminData,
      yourActivities,
      yourOrganization,
    };

    return res.status(200).send(responseObj);
  } catch (err) {
    console.log(err);
    return res.status(500).send({ message: 'Something went wrong' });
  }
};

export const getUnapprovedOrganizations = async (req, res) => {
  try {
    const organizations = await getOrganizationActivationStatus(DB);
    return res.status(200).send(organizations);
  } catch (err) {
    console.log(err);
    return res.status(400).send({ message: 'Invalid user inputs' });
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
    return res.status(500).send({ message: 'Something went wrong' });
  }
};

export const getResources = async (req, res) => {
  try {
    const resources = await DB('resources')
      .select('name', 'id');
    return res.status(200).send(resources);
  } catch (err) {
    console.log(err);
    return res.status(500).send({ message: 'Something went wrong' });
  }
};

export const createResources = async (req, res) => {
  try {
    const { name, unit } = req.body;
    const resourceAvailability = await DB('resources')
      .select('name', 'id')
      .where('name', name.toLowerCase())
      .first();
    if (resourceAvailability) {
      return res.status(403).send({ message: 'Item already added' });
    }
    await DB('resources')
      .insert({ unit: unit.value, name });
    const resources = await DB('resources')
      .select('name', 'id');
    return res.status(200).send(resources);
  } catch (err) {
    console.log(err);
    return res.status(500).send({ message: 'Something went wrong' });
  }
};
export const createCategories = async (req, res) => {
  try {
    const { name } = req.body;
    const categoryAvailability = await DB('categories')
      .select('name', 'id')
      .where('name', name.toLowerCase())
      .first();
    if (categoryAvailability) {
      return res.status(403).send({ message: 'Category already added' });
    }
    await DB('categories')
      .insert({ name });
    const categories = await DB('categories')
      .select('name', 'id');
    return res.status(200).send(categories);
  } catch (err) {
    console.log(err);
    return res.status(500).send({ message: 'Something went wrong' });
  }
};

export const getCategories = async (req, res) => {
  try {
    const categories = await DB('categories')
      .select('name', 'id');
    return res.status(200).send(categories);
  } catch (err) {
    console.log(err);
    return res.status(500).send({ message: 'Something went wrong' });
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
    return res.status(500).send({ message: 'Something went wrong' });
  }
};

// Only organizations and super admins
export const getEvents = async (req, res) => {
  // Currently only main organization has access to this.
  const tokenData = extractToken(req);
  try {
    const eventQuery = DB('events as e')
      .leftJoin('organizations as o', 'o.id', 'e.main_organizer_id')
      .leftJoin('users as u', 'u.id', 'o.user_id')
      .leftJoin('event_pledges as ep', 'ep.event_id', 'e.id')
      .count('ep.id as pledges')
      .select(
        'e.id as id',
        'e.title as title',
        'e.is_active as isActive',
        'e.superadmin_deactivation as superadminDeactivation',
        'e.is_complete as isComplete',
        'u.name as mainOrganizer',
        'e.main_organizer_id as mainOrganizerId',
      )
      .groupBy('e.id');

    if (tokenData && tokenData.organization) {
      eventQuery
        .leftJoin('event_organizers as eo', 'eo.event_id', 'e.id')
        .where(function () {
          this.where('e.main_organizer_id', tokenData.organization.id).orWhere('eo.organization_id', tokenData.organization.id);
        });
    }

    const events = await eventQuery;
    return res.status(200).send(events);
  } catch (err) {
    console.log(err);
    return res.status(500).send({ message: 'Something went wrong' });
  }
};

export const getEventsBenefitted = async (req, res) => {
  // Currently only main organization has access to this.
  const tokenData = extractToken(req);
  const { organization } = tokenData;
  // console.log({ tokenData });
  try {
    const events = await DB('events as e')
      .leftJoin('organizations as o', 'o.id', 'e.main_organizer_id')
      .leftJoin('users as u', 'u.id', 'o.user_id')
      .leftJoin('event_beneficiaries as eb', 'eb.event_id', 'e.id')
      .where('eb.organization_id', organization.id)
      .select(
        'e.id as id',
        'e.title as title',
        'e.is_active as isActive',
        'e.superadmin_deactivation as superadminDeactivation',
        'e.is_complete as isComplete',
        'u.name as mainOrganizer',
        'e.main_organizer_id as mainOrganizerId',
      )
      .groupBy('e.id');

    return res.status(200).send(events);
  } catch (err) {
    console.log(err);
    return res.status(500).send({ message: 'Something went wrong' });
  }
};
