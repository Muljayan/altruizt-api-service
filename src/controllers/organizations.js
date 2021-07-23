import DB from '../config/database';
import { getEventsPreviewData } from '../helpers/events';
import { getOrganizationActivationStatus } from '../helpers/organizations';
import sendEmail from '../utils/email';
import extractToken from '../utils/extractToken';
import { FLAG_LIMIT } from '../config/settings';

// router.post('/', async (req, res) => {
export const searchOrganizations = async (req, res) => {
  const { searchString, isBeneficiary, resources } = req.body;

  const searchedResources = resources.map((resource) => resource.value);

  try {
    const organizationsQuery = DB('organizations as o')
      .join('users as u', 'u.id', 'o.user_id')
      .select('o.id as id', 'u.name as name', 'u.image as image', 'o.organization_type_id as type')
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
      let opportunities = [];
      if (organization.type === 3) {
        opportunities = await DB('events as e')
          .leftJoin('event_beneficiaries as eb', 'eb.event_id', 'e.id')
          .count('e.id as count')
          .where('eb.organization_id', organization.id)
          .first();
      } else {
        opportunities = await DB('events as e')
          .leftJoin('event_organizers as eo', 'eo.event_id', 'e.id')
          .count('e.id as count')
          .where(function () {
            this.where('eo.organization_id', organization.id).orWhere('e.main_organizer_id', organization.id);
          })
          .first();
      }

      responseData.push({
        ...organization,
        categories,
        opportunities: opportunities ? opportunities.count : 0,
      });
    }

    return res.status(200).send(responseData);
  } catch (err) {
    console.log(err);
    return res.status(500).send({ message: 'Something went wrong' });
  }
};

// router.post('/', async (req, res) => {
export const organizationsFollowed = async (req, res) => {
  const { searchString } = req.body;
  const tokenData = extractToken(req);
  const userId = tokenData.user.id;

  try {
    const organizationsQuery = DB('organizations as o')
      .leftJoin('users as u', 'u.id', 'o.user_id')
      .leftJoin('organization_followers as of', 'of.organization_id', 'o.id')
      .select('o.id as id', 'u.name as name', 'u.image as image', 'o.organization_type_id as type')
      .where('o.is_activated', true)
      .where('of.user_id', userId)
      .groupBy('o.id');

    if (searchString) {
      organizationsQuery
        .where('u.name', 'like', `%${searchString}%`);
    }

    const organizations = await organizationsQuery;
    const responseData = [];

    for await (const organization of organizations) {
      const categories = await DB('organization_categories as oc')
        .select('c.id as id', 'c.name as name')
        .join('categories as c', 'c.id', 'oc.category_id')
        .where('organization_id', organization.id);
      let opportunities = [];
      if (organization.type === 3) {
        opportunities = await DB('events as e')
          .leftJoin('event_beneficiaries as eb', 'eb.event_id', 'e.id')
          .count('e.id as count')
          .where('eb.organization_id', organization.id)
          .first();
      } else {
        opportunities = await DB('events as e')
          .leftJoin('event_organizers as eo', 'eo.event_id', 'e.id')
          .count('e.id as count')
          .where(function () {
            this.where('eo.organization_id', organization.id).orWhere('e.main_organizer_id', organization.id);
          })
          .first();
      }

      responseData.push({
        ...organization,
        categories,
        opportunities: opportunities ? opportunities.count : 0,
      });
    }

    return res.status(200).send(responseData);
  } catch (err) {
    console.log(err);
    return res.status(500).send({ message: 'Something went wrong' });
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
        'o.id as id',
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
      return res.status(404).send({ message: 'Not found' });
    }

    let resources = [];
    const currentEvents = [];
    const pastEvents = [];

    const eventQuery = DB('events as e')
      .select(
        'e.id', 'e.title', 'e.main_organizer_id as mainOrganizer',
        'e.is_complete as isComplete',
      )
      .where('e.is_active', true)
      .where('e.is_complete', false)
      // .where('e.is_complete', false)
      .groupBy('e.id');

    const pastEventQuery = DB('events as e')
      .select(
        'e.id', 'e.title', 'e.main_organizer_id as mainOrganizer',
      )
      .where('e.is_active', true)
      .where('e.is_complete', true)
      .groupBy('e.id');

    // Beneficiaries
    if (organization.type === 3) {
      resources = await DB('resources_needed as rn')
        .leftJoin('resources as r', 'r.id', 'rn.resource_id')
        .select('r.id as id', 'r.name as name', 'r.unit as unit', 'rn.quantity as quantity')
        .where('rn.organization_id', id);

      // join beneficiaries and search
      eventQuery
        .leftJoin('event_beneficiaries as eb', 'eb.event_id', 'e.id')
        .where('eb.organization_id', id);
      pastEventQuery
        .leftJoin('event_beneficiaries as eb', 'eb.event_id', 'e.id')
        .where('eb.organization_id', id);
    } else {
      resources = await DB('resources_available as ra')
        .select('r.id as id', 'r.name as name', 'r.unit as unit', 'ra.quantity as quantity')
        .join('resources as r', 'r.id', 'ra.resource_id')
        .where('ra.organization_id', id);
      // Join
      eventQuery
        .leftJoin('event_organizers as eo', 'eo.event_id', 'e.id')
        .where(function () {
          this.where('eo.organization_id', id).orWhere('e.main_organizer_id', id);
        });
      pastEventQuery
        .leftJoin('event_organizers as eo', 'eo.event_id', 'e.id')
        .where(function () {
          this.where('eo.organization_id', id).orWhere('e.main_organizer_id', id);
        });
    }
    const currentEventList = await eventQuery;

    for await (const event of currentEventList) {
      const eventData = await getEventsPreviewData(event, DB);
      currentEvents.push(eventData);
    }
    const pastEventList = await pastEventQuery;
    for await (const event of pastEventList) {
      const eventData = await getEventsPreviewData(event, DB);
      pastEvents.push(eventData);
    }

    // --------------------
    let organizationFollowed = false;
    let upvoted = false;
    let downvoted = false;
    if (tokenData) {
      const follow = await DB('organization_followers')
        .where('organization_id', id)
        .where('user_id', tokenData.user.id)
        .first();
      if (follow) {
        organizationFollowed = true;
      }
      const ratings = await DB('organization_ratings')
        .where('organization_id', id)
        .where('user_id', tokenData.user.id)
        .select('value')
        .first();
      if (ratings) {
        if (Number(ratings.value) === -1) {
          downvoted = true;
        }
        if (Number(ratings.value) === 1) {
          upvoted = true;
        }
      }
    }
    // --------------------

    const responseData = {
      // categories
      ...organization,
      resources,
      currentEvents,
      pastEvents,
      organizationFollowed,
      downvoted,
      upvoted,
      isActive: true,
    };
    return res.status(200).send(responseData);
  } catch (err) {
    console.log(err);
    return res.status(500).send({ message: 'Something went wrong' });
  }
};

// router.put('/profile/:id/toggle-activation-status', );
export const toggleActivationStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const organization = await DB('organizations as o')
      .leftJoin('users as u', 'u.id', 'o.user_id')
      .select('o.is_activated as isActivated', 'u.email as email')
      .where('o.id', id)
      .first();

    await DB('organizations')
      .update({ is_activated: !organization.isActivated })
      .where('id', id);
    const responseData = await getOrganizationActivationStatus(DB);
    if (!organization.isActivated) {
      await sendEmail(organization.email, 'Your Organization is activated', 'Your Organization is activated');
    } else {
      await sendEmail(organization.email, 'Your Organization is deactivated', 'Your Organization is deactivated');
    }
    return res.status(200).send(responseData);
  } catch (err) {
    console.log(err);
    return res.status(500).send({ message: 'Something went wrong' });
  }
};

export const getIndividuals = async (req, res) => {
  try {
    const responseObj = {};
    return res.status(500).send(responseObj);
  } catch (err) {
    console.log(err);
    return res.status(500).send({ message: 'Something went wrong' });
  }
};

export const getCorporates = async (req, res) => {
  try {
    const responseObj = {};
    return res.status(500).send(responseObj);
  } catch (err) {
    console.log(err);
    return res.status(500).send({ message: 'Something went wrong' });
  }
};

export const getVolunteerOrganizations = async (req, res) => {
  try {
    const responseObj = {};
    return res.status(500).send(responseObj);
  } catch (err) {
    console.log(err);
    return res.status(500).send({ message: 'Something went wrong' });
  }
};

export const getBeneficiaries = async (req, res) => {
  try {
    const responseObj = {};
    return res.status(500).send(responseObj);
  } catch (err) {
    console.log(err);
    return res.status(500).send({ message: 'Something went wrong' });
  }
};

export const getEvents = async (req, res) => {
  try {
    const responseObj = {};
    return res.status(500).send(responseObj);
  } catch (err) {
    console.log(err);
    return res.status(500).send({ message: 'Something went wrong' });
  }
};

export const upvote = async (req, res) => {
  const { id } = req.params;
  const tokenData = extractToken(req);
  const { user } = tokenData;
  const trx = await DB.transaction();
  try {
    const ratings = await trx('organization_ratings')
      .where('user_id', user.id)
      .where('organization_id', id)
      .select('value')
      .first();

    if (ratings) {
      // remove
      if (Number(ratings.value) === 1) {
        await trx('organization_ratings')
          .where('user_id', user.id)
          .where('organization_id', id)
          .update({ value: 0 });
      } else {
        await trx('organization_ratings')
          .where('user_id', user.id)
          .where('organization_id', id)
          .update({ value: 1 });
      }
    } else {
      // add
      const ratingData = { user_id: user.id, organization_id: id, value: 1 };
      await trx('organization_ratings')
        .insert(ratingData);
    }
    trx.commit();
    return res.status(200).send({ message: 'success' });
  } catch (err) {
    trx.rollback();
    console.log(err);
    return res.status(500).send({ message: 'Something went wrong' });
  }
};

export const downvote = async (req, res) => {
  const { id } = req.params;
  const tokenData = extractToken(req);
  const { user } = tokenData;
  const trx = await DB.transaction();
  try {
    const ratings = await trx('organization_ratings')
      .where('user_id', user.id)
      .where('organization_id', id)
      .select('value')
      .first();
    if (ratings) {
      // remove
      if (Number(ratings.value) === -1) {
        await trx('organization_ratings')
          .where('user_id', user.id)
          .where('organization_id', id)
          .update({ value: 0 });
      } else {
        await trx('organization_ratings')
          .where('user_id', user.id)
          .where('organization_id', id)
          .update({ value: -1 });
      }
    } else {
      // add
      const ratingData = { user_id: user.id, organization_id: id, value: -1 };
      await trx('organization_ratings')
        .insert(ratingData);
    }

    const OrganizationRating = await trx('organization_ratings as or')
      .leftJoin('organizations as o', 'o.id', 'or.organization_id')
      .leftJoin('users as u', 'u.id', 'o.user_id')
      .sum('or.value as value')
      .select('o.id as id', 'u.email as email')
      .where('o.id', id)
      .first();

    if (Number(OrganizationRating.value) <= FLAG_LIMIT) {
      const message = 'Organization deactivated, flagged too many times. Contact the super admin!';
      await trx('events')
        .update({
          is_activated: false,
        })
        .where('id', id);
      await sendEmail(OrganizationRating.email, `Your event #${id} has been flagged`, message);
    }
    trx.commit();
    return res.status(200).send({ message: 'success' });
  } catch (err) {
    trx.rollback();
    console.log(err);
    return res.status(500).send({ message: 'Something went wrong' });
  }
};

export const toggleEventFollow = async (req, res) => {
  const { id } = req.params;
  const tokenData = extractToken(req);
  const { user } = tokenData;
  try {
    const followers = await DB('organization_followers')
      .where('user_id', user.id)
      .where('organization_id', id)
      .first();
    if (followers) {
      // remove
      await DB('organization_followers')
        .where('user_id', user.id)
        .where('organization_id', id)
        .delete();
    } else {
      // add
      const followerData = { user_id: user.id, organization_id: id };
      await DB('organization_followers')
        .insert(followerData);
    }
    return res.status(200).send({ message: 'success' });
  } catch (err) {
    console.log(err);
    return res.status(500).send({ message: 'Something went wrong' });
  }
};
