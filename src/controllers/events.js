const express = require('express');
const DB = require('../config/database');

const router = express.Router();
// const DB = require('../config/database');
const extractToken = require('../utils/extractToken');

router.post('/create', async (req, res) => {
  const trx = await DB.transaction();
  try {
    const tokenData = extractToken(req);
    const { organization } = tokenData;
    // TODO move this to middleware
    if (!organization) {
      return res.status(401).send({ message: 'Your cannot create events!' });
    }

    const {
      title,
      startDate,
      endDate,
      contactName,
      phone,
      location,
      description,
      bankName,
      bankBranch,
      bankNumber,
      categories,
      resources,
      collaborators,
      beneficiaries,
    } = req.body;

    if (resources.length < 1) {
      return res.status(400).send('Resources needed not added');
    }
    if (beneficiaries.length < 1) {
      return res.status(400).send('Beneficiaries not added');
    }

    const data = {
      is_active: true,
      title,
      description,
      start_date: startDate,
      end_date: endDate,
      location,
      contact_name: contactName,
      phone,
      bank_account_name: bankName,
      bank_account_number: bankNumber,
      bank_account_branch: bankBranch,
      main_organizer_id: organization.id,
    };
    const eventId = await trx('events')
      .insert(data);

    // Add event interaction counter
    await trx('event_interactions')
      .insert({ event_id: eventId, count: 0 });

    // Add event categories
    if (categories && categories.length > 0) {
      for await (const category of categories) {
        await trx('event_categories')
          .insert({ event_id: eventId, category_id: category.value });
      }
    }

    // Add event organizers
    if (collaborators && collaborators.length > 0) {
      for await (const collaborator of collaborators) {
        await trx('event_organizers')
          .insert({ event_id: eventId, category_id: collaborator.value });
      }
    }

    // Add event beneficiaries
    if (beneficiaries && beneficiaries.length > 0) {
      for await (const beneficiary of beneficiaries) {
        await trx('event_beneficiaries')
          .insert({ event_id: eventId, organization_id: beneficiary.value });
      }
    }

    // Add event beneficiaries
    if (resources && resources.length > 0) {
      for await (const resource of resources) {
        const resourceId = await trx('resources')
          .select('id')
          .where('name', resource.name.toString().toLowerCase())
          .first();

        await trx('event_resources_needed')
          .insert({ event_id: eventId, resource_id: resourceId.id, quantity: resource.quantity });
        await trx('event_resources_received')
          .insert({ event_id: eventId, resource_id: resourceId.id, quantity: 0 });
      }
    }

    trx.commit();
    return res.status(201).send({ success: true, message: 'Event created succesfully', eventId });
  } catch (err) {
    trx.rollback();
    console.log(err);
    return res.status(400).send('Invalid user inputs');
  }
});

router.get('/profile/:id', async (req, res) => {
  const { id } = req.params;
  const tokenData = extractToken(req);
  const trx = await DB.transaction();

  try {
    if (!id) {
      return res.status(404).send('Event does not exist!');
    }

    // Find event
    const event = await trx('events')
      .select('id', 'is_active as isActive', 'title', 'description', 'start_date as startDate', 'end_date as endDate', 'location',
        'contact_name as contactName', 'phone', 'bank_account_name as bankName', 'bank_account_number as bankNumber', 'bank_account_branch as bankBranch',
        'main_organizer_id as mainOrganizer')
      .where('id', id)
      .first();

    const mainOrganizer = await trx('organizations as o')
      .join('users as u', 'u.id', 'o.user_id')
      .select('o.id as id', 'u.name as name')
      .where('o.id', event.mainOrganizer)
      .first();

    if (!event) {
      return res.status(404).send('Event does not exist!');
    }

    const eventCategories = await trx('event_categories as ec')
      .select('ec.category_id as id', 'c.name as name')
      .join('categories as c', 'c.id', 'ec.category_id')
      .where('ec.event_id', id);

    const eventResourcesNeeded = await trx('event_resources_needed as ern')
      .select('r.name as name', 'r.unit as unit', 'ern.resource_id as id', 'ern.quantity as quantity')
      .join('resources as r', 'r.id', 'ern.resource_id')
      .where('ern.event_id', id);

    const eventResourcesReceived = await trx('event_resources_received as err')
      .select('r.name as name', 'r.unit as unit', 'err.resource_id as id', 'err.quantity as quantity')
      .join('resources as r', 'r.id', 'err.resource_id')
      .where('err.event_id', id);

    const eventResourcesProgress = await trx('resources as r')
      .select('r.name as name', 'r.unit as unit', 'ern.resource_id as id', 'ern.quantity as neededQuantity', 'err.quantity as receivedQuantity')
      .join('event_resources_needed as ern', 'r.id', 'ern.resource_id')
      .leftJoin('event_resources_received as err', 'err.event_id', 'ern.event_id')
      .where('ern.event_id', id);

    const eventLogs = await trx('event_logs')
      .select('id', 'entry', 'date')
      .where('event_id', id);

    const eventbeneficiaries = await trx('event_beneficiaries as eb')
      .select('u.name as name', 'o.id as id')
      .join('organizations as o', 'o.id', 'eb.organization_id')
      .join('users as u', 'u.id', 'o.user_id')
      .where('eb.event_id', id);

    const eventOrganizers = await trx('event_organizers as eo')
      .select('u.name as name', 'o.id as id')
      .join('organizations as o', 'o.id', 'eo.organization_id')
      .join('users as u', 'u.id', 'o.user_id')
      .where('eo.event_id', id);

    // Add main organizer in list
    eventOrganizers.unshift(mainOrganizer);

    // Check if user follows or pledged to the event
    let eventPledged = false;
    let eventFollowed = false;
    if (tokenData) {
      const pledge = await trx('event_pledges')
        .where('event_id', id)
        .where('user_id', tokenData.user.id)
        .first();
      if (pledge) {
        eventPledged = true;
      }
      const follow = await trx('event_followers')
        .where('event_id', id)
        .where('user_id', tokenData.user.id)
        .first();
      if (follow) {
        eventFollowed = true;
      }
    }

    // Update interaction count
    const eventInteractions = await trx('event_interactions')
      .select('count')
      .where('event_id', event.id)
      .first();
    await trx('event_interactions')
      .update({ count: (eventInteractions.count + 1) });

    const responseData = {
      ...event,
      categories: eventCategories,
      resourcesNeeded: eventResourcesNeeded,
      resourcesReceived: eventResourcesReceived,
      resourcesProgress: eventResourcesProgress,
      logs: eventLogs,
      beneficiaries: eventbeneficiaries,
      organizers: eventOrganizers,
      eventPledged,
      eventFollowed,
    };

    trx.commit();
    return res.status(200).send(responseData);
  } catch (err) {
    trx.rollback();
    console.log(err);
    return res.status(500).send('Something went wrong');
  }
});

router.post('/', async (req, res) => {
  const tokenData = extractToken(req);
  const { searchString, resources, personalized } = req.body;
  try {
    let categoriesFollowed = [];
    if (tokenData && tokenData.categoriesFollowed && tokenData.categoriesFollowed.length > 0) {
      categoriesFollowed = tokenData.categoriesFollowed.map((category) => category.id);
    }

    const searchedResources = resources.map((resource) => resource.value);

    const eventQuery = DB('events as e')
      .select(
        'e.id', 'e.title', 'e.main_organizer_id as mainOrganizer', 'ern.id as ernId',
      )
      .groupBy('e.id')
      .join('event_resources_needed as ern', 'ern.event_id', 'e.id')
      .leftJoin('event_categories as ec', 'ec.event_id', 'e.id')
      .where('e.is_active', true)
      .where('e.is_complete', false);

    // Gets events based on categories user has followed
    if (categoriesFollowed.length > 0 && personalized) {
      eventQuery
        .whereIn('ec.category_id', categoriesFollowed);
    }
    // Gets events based on resources searched
    if (searchedResources.length > 0) {
      eventQuery
        .whereIn('ern.resource_id', searchedResources);
    }

    if (searchString) {
      eventQuery
        .where('e.title', 'like', `%${searchString}%`);
    }

    const events = await eventQuery;
    const responseData = [];

    for await (const event of events) {
      const mainOrganizer = await DB('organizations as o')
        .join('users as u', 'u.id', 'o.user_id')
        .select('o.id as id', 'u.name as name')
        .where('o.id', event.mainOrganizer)
        .first();

      const eventCategories = await DB('event_categories as ec')
        .select('ec.category_id as id', 'c.name as name')
        .join('categories as c', 'c.id', 'ec.category_id')
        .where('ec.event_id', event.id);

      const eventbeneficiaries = await DB('event_beneficiaries as eb')
        .select('u.name as name', 'o.id as id')
        .join('organizations as o', 'o.id', 'eb.organization_id')
        .join('users as u', 'u.id', 'o.user_id')
        .where('eb.event_id', event.id);

      const eventOrganizers = await DB('event_organizers as eo')
        .select('u.name as name', 'o.id as id')
        .join('organizations as o', 'o.id', 'eo.organization_id')
        .join('users as u', 'u.id', 'o.user_id')
        .where('eo.event_id', event.id);

      const eventResourcesProgress = await DB('resources as r')
        .select('r.name as name', 'r.unit as unit', 'ern.resource_id as id', 'ern.quantity as neededQuantity', 'err.quantity as receivedQuantity')
        .join('event_resources_needed as ern', 'r.id', 'ern.resource_id')
        .leftJoin('event_resources_received as err', 'err.event_id', 'ern.event_id')
        .where('ern.event_id', event.id);

      let progress = 0;

      if (eventResourcesProgress) {
        for await (const resource of eventResourcesProgress) {
          progress += resource.receivedQuantity / resource.neededQuantity;
        }
        progress = (progress * 100) / eventResourcesProgress.length;
      }

      responseData.push({
        ...event,
        categories: eventCategories,
        beneficiaries: eventbeneficiaries,
        mainOrganizer,
        organizers: eventOrganizers,
        progress,
      });
    }

    return res.status(200).send(responseData);
  } catch (err) {
    console.log(err);
    return res.status(500).send('Something went wrong');
  }
});

router.get('/suggestions', async (req, res) => {
  const tokenData = extractToken(req);
  console.log(tokenData);
  try {
    const categories = await DB('categories')
      .select('id', 'name');

    const responseData = [];

    for await (const category of categories) {
      const events = await DB('events as e')
        .select('e.id as id', 'e.title as name')
        .join('event_categories as ec', 'ec.event_id', 'e.id')
        .where('ec.category_id', category.id);
      if (events && events.length > 0) {
        responseData.push({ ...category, events });
      }
    }

    return res.status(201).send(responseData);
  } catch (err) {
    console.log(err);
    return res.status(400).send({ message: 'invalid user inputs' });
  }
});

router.post('/followings', async (req, res) => {
  const tokenData = extractToken(req);
  const { searchString, resources } = req.body;
  const { user } = tokenData;
  try {
    const searchedResources = resources.map((resource) => resource.value);

    const eventQuery = DB('events as e')
      .select(
        'e.id', 'e.title', 'e.main_organizer_id as mainOrganizer', 'ern.id as ernId',
      )
      .groupBy('e.id')
      .join('event_resources_needed as ern', 'ern.event_id', 'e.id')
      .join('event_followers as ef', 'ef.event_id', 'e.id')
      .leftJoin('event_categories as ec', 'ec.event_id', 'e.id')
      .where('e.is_active', true)
      .where('ef.user_id', user.id)
      .where('e.is_complete', false);

    // Gets events based on resources searched
    if (searchedResources.length > 0) {
      eventQuery
        .whereIn('ern.resource_id', searchedResources);
    }

    if (searchString) {
      eventQuery
        .where('e.title', 'like', `%${searchString}%`);
    }

    const events = await eventQuery;
    const responseData = [];

    for await (const event of events) {
      const mainOrganizer = await DB('organizations as o')
        .join('users as u', 'u.id', 'o.user_id')
        .select('o.id as id', 'u.name as name')
        .where('o.id', event.mainOrganizer)
        .first();

      const eventCategories = await DB('event_categories as ec')
        .select('ec.category_id as id', 'c.name as name')
        .join('categories as c', 'c.id', 'ec.category_id')
        .where('ec.event_id', event.id);

      const eventbeneficiaries = await DB('event_beneficiaries as eb')
        .select('u.name as name', 'o.id as id')
        .join('organizations as o', 'o.id', 'eb.organization_id')
        .join('users as u', 'u.id', 'o.user_id')
        .where('eb.event_id', event.id);

      const eventOrganizers = await DB('event_organizers as eo')
        .select('u.name as name', 'o.id as id')
        .join('organizations as o', 'o.id', 'eo.organization_id')
        .join('users as u', 'u.id', 'o.user_id')
        .where('eo.event_id', event.id);

      const eventResourcesProgress = await DB('resources as r')
        .select('r.name as name', 'r.unit as unit', 'ern.resource_id as id', 'ern.quantity as neededQuantity', 'err.quantity as receivedQuantity')
        .join('event_resources_needed as ern', 'r.id', 'ern.resource_id')
        .leftJoin('event_resources_received as err', 'err.event_id', 'ern.event_id')
        .where('ern.event_id', event.id);

      let progress = 0;

      if (eventResourcesProgress) {
        for await (const resource of eventResourcesProgress) {
          progress += resource.receivedQuantity / resource.neededQuantity;
        }
        progress = (progress * 100) / eventResourcesProgress.length;
      }

      responseData.push({
        ...event,
        categories: eventCategories,
        beneficiaries: eventbeneficiaries,
        mainOrganizer,
        organizers: eventOrganizers,
        progress,
      });
    }

    return res.status(200).send(responseData);
  } catch (err) {
    console.log(err);
    return res.status(500).send('Something went wrong');
  }
});

module.exports = router;
