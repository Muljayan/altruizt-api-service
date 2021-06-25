import { promises as fs } from 'fs';

import DB from '../config/database';

import extractToken from '../utils/extractToken';
import { getEventsPreviewData } from '../helpers/events';
import { imageExtractor } from '../utils/extractors';
import { EVENT_IMAGE_DIRECTORY } from '../config/directories';

// router.post('/create', async (req, res) => {
export const createEvent = async (req, res) => {
  const trx = await DB.transaction();
  try {
    const tokenData = extractToken(req);
    const { organization } = tokenData;
    // TODO move this to middleware
    if (!organization) {
      trx.rollback();
      return res.status(401).send({ message: 'Your cannot create events!' });
    }

    const {
      title,
      image,
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
      trx.rollback();
      return res.status(400).send('Resources needed not added');
    }
    if (beneficiaries.length < 1) {
      trx.rollback();
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
          .insert({ event_id: eventId, organization_id: collaborator.value });
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
        let resourceId;
        const fetchedResource = await trx('resources')
          .select('id')
          .where('name', resource.name.toString().toLowerCase())
          .first();
        if (!fetchedResource) {
          const insertedResource = await trx('resources')
            .insert({
              name: resource.name.toString().toLowerCase(),
              unit: resource.unit.toString().toLowerCase(),
            });
          [resourceId] = insertedResource;
        } else {
          resourceId = fetchedResource.id;
        }

        await trx('event_resources_needed')
          .insert({ event_id: eventId, resource_id: resourceId, quantity: resource.quantity });
        await trx('event_resources_received')
          .insert({ event_id: eventId, resource_id: resourceId, quantity: 0 });
      }
    }
    if (image && image.value) {
      const { extension, fmtImg } = imageExtractor(image);

      try {
        const eventsImage = await trx('events')
          .select('image')
          .where('id', eventId);

        const currentImageLocation = `${EVENT_IMAGE_DIRECTORY}/${eventsImage.image}`;

        await fs.stat(currentImageLocation);
        await fs.unlink(currentImageLocation);
      } catch (err) {
        console.log('file does not exist for user');
      }
      const imageName = `${eventId}.${extension}`;

      const imagePath = `${EVENT_IMAGE_DIRECTORY}/${imageName}`;
      await fs.writeFile(imagePath, fmtImg, 'base64');

      await trx('events')
        .where('id', eventId)
        .update({ image: imageName });
    }

    trx.commit();
    return res.status(201).send({ success: true, message: 'Event created succesfully', eventId });
  } catch (err) {
    trx.rollback();
    console.log(err);
    return res.status(400).send('Invalid user inputs');
  }
};

// router.put('/profile/:id/update'
export const updateEventProfile = async (req, res) => {
  const { id } = req.params;
  const trx = await DB.transaction();
  try {
    const tokenData = extractToken(req);
    const { organization } = tokenData;
    // TODO move this to middleware
    if (!organization) {
      trx.rollback();
      return res.status(401).send({ message: 'Your cannot update this event!' });
    }
    const checkIfMainOrganizer = await DB('events as e')
      .where('e.id', id)
      .where('e.main_organizer_id', organization.id)
      .first();
    const checkIfCollaborator = await DB('events as e')
      .leftJoin('event_organizers as eo', 'eo.event_id', 'e.id')
      .where('e.id', id)
      .where('eo.organization_id', organization.id)
      .first();

    if (!(checkIfMainOrganizer || checkIfCollaborator)) {
      trx.rollback();
      return res.status(401).send({ message: 'Your cannot update this event!' });
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
      resourcesReceived,
      updateDescription,
      image,
    } = req.body;

    if (resources.length < 1) {
      trx.rollback();
      return res.status(400).send('Resources needed not added');
    }
    if (beneficiaries.length < 1) {
      trx.rollback();
      return res.status(400).send('Beneficiaries not added');
    }

    const data = {
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
    };
    await trx('events')
      .update(data)
      .where('id', id);

    // Add event categories
    if (categories && categories.length > 0) {
      await trx('event_categories')
        .delete()
        .where('event_id', id);
      for await (const category of categories) {
        await trx('event_categories')
          .insert({ event_id: id, category_id: category.value });
      }
    }

    await trx('event_organizers')
      .delete()
      .where('event_id', id);
    // Add event organizers
    if (collaborators && collaborators.length > 0) {
      for await (const collaborator of collaborators) {
        await trx('event_organizers')
          .insert({ event_id: id, organization_id: collaborator.value });
      }
    }

    // Add event beneficiaries
    if (beneficiaries && beneficiaries.length > 0) {
      await trx('event_beneficiaries')
        .delete()
        .where('event_id', id);
      for await (const beneficiary of beneficiaries) {
        await trx('event_beneficiaries')
          .insert({ event_id: id, organization_id: beneficiary.value });
      }
    }

    // Add event beneficiaries
    // Add event beneficiaries
    if (resources && resources.length > 0) {
      await trx('event_resources_needed')
        .delete()
        .where('event_id', id);
      await trx('event_resources_received')
        .delete()
        .where('event_id', id);
      for await (const resource of resources) {
        let resourceId = await trx('resources')
          .select('id')
          .where('name', resource.name.toString().toLowerCase())
          .first();
        if (!resourceId) {
          const insertedResource = await trx('resources')
            .insert({
              name: resource.name.toString().toLowerCase(),
              unit: resource.unit.toString().toLowerCase(),
            });
          resourceId = { id: insertedResource[0] };
        }

        await trx('event_resources_needed')
          .insert({ event_id: id, resource_id: resourceId.id, quantity: resource.quantity });
        await trx('event_resources_received')
          .insert({ event_id: id, resource_id: resourceId.id, quantity: 0 });
      }
    }
    if (resourcesReceived && resourcesReceived.length > 0) {
      for await (const resource of resourcesReceived) {
        const retrievedResource = await trx('resources')
          .where('name', resource.name.toString().toLowerCase())
          .first();
        if (retrievedResource) {
          await trx('event_resources_received')
            .update({ quantity: resource.quantity })
            .where('event_id', id)
            .where('resource_id', retrievedResource.id);
        }
      }
    }

    if (updateDescription) {
      const eventLogData = {
        event_id: id,
        entry: updateDescription,
        date: new Date(),
      };
      await trx('event_logs')
        .insert(eventLogData);
    }

    // -----------------------------------------------
    if (image && image.value) {
      const { extension, fmtImg } = imageExtractor(image);

      try {
        const eventImage = await trx('events')
          .select('image')
          .where('id', id);

        const currentImageLocation = `${EVENT_IMAGE_DIRECTORY}/${eventImage.image}`;

        await fs.stat(currentImageLocation);
        await fs.unlink(currentImageLocation);
      } catch (err) {
        console.log('file does not exist for user');
      }
      const imageName = `${id}.${extension}`;

      const imagePath = `${EVENT_IMAGE_DIRECTORY}/${imageName}`;
      await fs.writeFile(imagePath, fmtImg, 'base64');

      await trx('events')
        .where('id', id)
        .update({ image: imageName });
    }
    // -----------------------------------------------

    trx.commit();
    return res.status(201).send({ success: true, message: 'Event updated succesfully', id });
  } catch (err) {
    trx.rollback();
    console.log(err);
    return res.status(400).send('Invalid user inputs');
  }
};

// router.get('/profile/:id', async (req, res) => {
export const getEventProfile = async (req, res) => {
  const { id } = req.params;
  const tokenData = extractToken(req);
  const trx = await DB.transaction();

  try {
    if (!id) {
      trx.rollback();
      return res.status(404).send('Event does not exist!');
    }

    // Find event
    const event = await trx('events')
      .select('id', 'is_active as isActive', 'title', 'description', 'start_date as startDate', 'end_date as endDate', 'location',
        'contact_name as contactName', 'phone', 'bank_account_name as bankName', 'bank_account_number as bankNumber', 'bank_account_branch as bankBranch',
        'image',
        'main_organizer_id as mainOrganizer')
      .where('id', id)
      .first();

    if (!event) {
      trx.rollback();
      return res.status(404).send('Event does not exist!');
    }

    const mainOrganizer = await trx('organizations as o')
      .join('users as u', 'u.id', 'o.user_id')
      .select('o.id as id', 'u.name as name', 'u.image as image')
      .where('o.id', event.mainOrganizer)
      .first();

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
      .leftJoin('event_resources_needed as ern', 'r.id', 'ern.resource_id')
      .leftJoin('event_resources_received as err', 'r.id', 'err.resource_id')
      .where('ern.event_id', id)
      .where('err.event_id', id);

    const eventLogs = await trx('event_logs')
      .select('id', 'entry', 'date')
      .where('event_id', id);

    const eventbeneficiaries = await trx('event_beneficiaries as eb')
      .select('u.name as name', 'o.id as id', 'u.image as image')
      .join('organizations as o', 'o.id', 'eb.organization_id')
      .join('users as u', 'u.id', 'o.user_id')
      .groupBy('o.id')
      .where('eb.event_id', id);

    const eventOrganizers = await trx('event_organizers as eo')
      .select('u.name as name', 'o.id as id', 'u.image as image')
      .join('organizations as o', 'o.id', 'eo.organization_id')
      .join('users as u', 'u.id', 'o.user_id')
      .groupBy('o.id')
      .whereNot('o.id', mainOrganizer.id)
      .where('eo.event_id', id);

    // Add main organizer in list
    // eventOrganizers.unshift(mainOrganizer);

    // Check if user follows or pledged to the event
    let eventPledged = false;
    let eventFollowed = false;
    let upvoted = false;
    let downvoted = false;
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
      const ratings = await trx('event_ratings')
        .where('event_id', id)
        .where('user_id', tokenData.user.id)
        .select('value')
        .first();
      if (ratings) {
        // eventFollowed = true;
        if (Number(ratings.value) === -1) {
          downvoted = true;
        }
        if (Number(ratings.value) === 1) {
          upvoted = true;
        }
      }
    }

    // Update interaction count
    const eventInteractions = await trx('event_interactions')
      .select('count')
      .where('event_id', event.id)
      .first();
    await trx('event_interactions')
      .update({ count: (eventInteractions.count + 1) });

    let progress = 0;

    if (eventResourcesProgress) {
      for await (const resource of eventResourcesProgress) {
        const calculatedValue = resource.receivedQuantity / resource.neededQuantity;
        progress += (calculatedValue > 1 ? 1 : calculatedValue);
      }
      progress = (progress * 100) / eventResourcesProgress.length;
    }

    const responseData = {
      ...event,
      progress,
      categories: eventCategories,
      resourcesNeeded: eventResourcesNeeded,
      resourcesReceived: eventResourcesReceived,
      resourcesProgress: eventResourcesProgress,
      logs: eventLogs,
      beneficiaries: eventbeneficiaries,
      organizers: eventOrganizers,
      mainOrganizer,
      eventPledged,
      eventFollowed,
      downvoted,
      upvoted,
    };
    trx.commit();
    return res.status(200).send(responseData);
  } catch (err) {
    trx.rollback();
    console.log(err);
    return res.status(500).send('Something went wrong');
  }
};

// router.post('/', async (req, res) => {
export const searchEvents = async (req, res) => {
  const tokenData = extractToken(req);
  const { searchString, resources, personalized } = req.body;
  try {
    let categoriesFollowed = [];
    // if (tokenData && tokenData.categoriesFollowed && tokenData.categoriesFollowed.length > 0) {
    //   categoriesFollowed = tokenData.categoriesFollowed.map((category) => category.id);
    // }
    if (tokenData && tokenData.user) {
      const cat = await DB('categories_followed')
        .select('category_id as categoryId')
        .where('user_id', tokenData.user.id);
      categoriesFollowed = cat.map((category) => category.categoryId);
    }

    const searchedResources = resources.map((resource) => resource.value);

    const eventQuery = DB('events as e')
      .select(
        'e.id', 'e.title', 'e.main_organizer_id as mainOrganizer', 'ern.id as ernId',
        'e.image',
      )
      .join('event_resources_needed as ern', 'ern.event_id', 'e.id')
      .leftJoin('event_categories as ec', 'ec.event_id', 'e.id')
      .where('e.is_active', true)
      .where('e.is_complete', false)
      .groupBy('e.id');

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
      const eventData = await getEventsPreviewData(event, DB);
      responseData.push(eventData);
    }
    return res.status(200).send(responseData);
  } catch (err) {
    console.log(err);
    return res.status(500).send('Something went wrong');
  }
};

// router.post('/followings', );
export const searchEventsFollowed = async (req, res) => {
  const tokenData = extractToken(req);
  const { searchString, resources } = req.body;
  const { user } = tokenData;
  try {
    const searchedResources = resources.map((resource) => resource.value);

    const eventQuery = DB('events as e')
      .select(
        'e.id', 'e.title', 'e.main_organizer_id as mainOrganizer', 'ern.id as ernId',
      )
      .join('event_resources_needed as ern', 'ern.event_id', 'e.id')
      .join('event_followers as ef', 'ef.event_id', 'e.id')
      .leftJoin('event_categories as ec', 'ec.event_id', 'e.id')
      .where('e.is_active', true)
      .where('ef.user_id', user.id)
      .where('e.is_complete', false)
      .groupBy('e.id');

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
        .select('o.id as id', 'u.name as name', 'u.image as image')
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
        .leftJoin('event_resources_received as err', 'err.resource_id', 'r.id')
        .where('ern.event_id', event.id)
        .where('err.event_id', event.id)
        .groupBy('r.id');

      let progress = 0;

      if (eventResourcesProgress) {
        for await (const resource of eventResourcesProgress) {
          const calculatedValue = resource.receivedQuantity / resource.neededQuantity;
          progress += (calculatedValue > 1 ? 1 : calculatedValue);
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
};

// get /events/profile/:id/pledges
export const getEventPledges = async (req, res) => {
  const { id } = req.params;
  const tokenData = extractToken(req);
  const { user } = tokenData;
  try {
    // Check if the user is the event organizer
    const event = await DB('events')
      .select('main_organizer_id as mainOrganizerId')
      .where('id', id);
    if (event.mainOrganizerId !== user.id) {
      const eventOrganizers = await DB('events as e')
        .select('eo.organization_id as id')
        .join('event_organizers as eo', 'eo.event_id', 'e.id')
        .where('e.id', id);

      let isAOrganizer = false;

      for await (const organizer of eventOrganizers) {
        if (organizer.id === user.id) {
          isAOrganizer = true;
        }
      }
      if (!isAOrganizer) {
        return res.status(404).send('Not an organizer');
      }
    }
    return res.status(200).send({ message: 'success' });
  } catch (err) {
    console.log(err);
    return res.status(500).send('Something went wrong');
  }
};

// put /events/profile/:id/follow
export const toggleEventFollow = async (req, res) => {
  const { id } = req.params;
  const tokenData = extractToken(req);
  const { user } = tokenData;
  try {
    const followers = await DB('event_followers')
      .where('user_id', user.id)
      .where('event_id', id)
      .first();
    if (followers) {
      // remove
      await DB('event_followers')
        .where('user_id', user.id)
        .where('event_id', id)
        .delete();
    } else {
      // add
      const followerData = { user_id: user.id, event_id: id };
      await DB('event_followers')
        .insert(followerData);
    }
    return res.status(200).send({ message: 'success' });
  } catch (err) {
    console.log(err);
    return res.status(500).send('Something went wrong');
  }
};
export const upvote = async (req, res) => {
  const { id } = req.params;
  const tokenData = extractToken(req);
  const { user } = tokenData;
  try {
    const ratings = await DB('event_ratings')
      .where('user_id', user.id)
      .where('event_id', id)
      .select('value')
      .first();
    if (ratings) {
      // remove
      if (Number(ratings.value) === 1) {
        await DB('event_ratings')
          .where('user_id', user.id)
          .where('event_id', id)
          .update({ value: 0 });
      } else {
        await DB('event_ratings')
          .where('user_id', user.id)
          .where('event_id', id)
          .update({ value: 1 });
      }
    } else {
      // add
      const ratingData = { user_id: user.id, event_id: id, value: 1 };
      await DB('event_ratings')
        .insert(ratingData);
    }
    return res.status(200).send({ message: 'success' });
  } catch (err) {
    console.log(err);
    return res.status(500).send('Something went wrong');
  }
};

export const downvote = async (req, res) => {
  const { id } = req.params;
  const tokenData = extractToken(req);
  const { user } = tokenData;
  try {
    const ratings = await DB('event_ratings')
      .where('user_id', user.id)
      .where('event_id', id)
      .select('value')
      .first();
    if (ratings) {
      // remove
      if (Number(ratings.value) === -1) {
        await DB('event_ratings')
          .where('user_id', user.id)
          .where('event_id', id)
          .update({ value: 0 });
      } else {
        await DB('event_ratings')
          .where('user_id', user.id)
          .where('event_id', id)
          .update({ value: -1 });
      }
    } else {
      // add
      const ratingData = { user_id: user.id, event_id: id, value: -1 };
      await DB('event_ratings')
        .insert(ratingData);
    }
    return res.status(200).send({ message: 'success' });
  } catch (err) {
    console.log(err);
    return res.status(500).send('Something went wrong');
  }
};

// put /events/profile/:id/pledge
export const toggleEventPledge = async (req, res) => {
  try {
    const { id } = req.params;
    const tokenData = extractToken(req);
    const { user } = tokenData;
    const pledge = await DB('event_pledges')
      .where('user_id', user.id)
      .where('event_id', id)
      .first();
    if (pledge) {
      // remove
      await DB('event_pledges')
        .where('user_id', user.id)
        .where('event_id', id)
        .delete();
    } else {
      // add
      const pledgeData = { user_id: user.id, event_id: id };
      await DB('event_pledges')
        .insert(pledgeData);
    }
    return res.status(200).send({ message: 'success' });
  } catch (err) {
    console.log(err);
    return res.status(500).send('Something went wrong');
  }
};

// put /events/profile/:id/rate
export const toggleEventRating = async (req, res) => {
  try {
    const { rateType } = req.body;
    let ratedValue = 1;
    if (rateType === 'down') {
      ratedValue = -1;
    }
    const { id } = req.params;
    const tokenData = extractToken(req);
    const { user } = tokenData;
    const rating = await DB('event_ratings')
      .where('user_id', user.id)
      .where('event_id', id)
      .first();
    if (rating) {
      // update
      await DB('event_ratings')
        .where('user_id', user.id)
        .where('event_id', id)
        .update({ value: ratedValue });
    } else {
      // add
      const ratingData = { user_id: user.id, event_id: id, value: ratedValue };
      await DB('event_ratings')
        .insert(ratingData);
    }
    return res.status(200).send({ message: 'success' });
  } catch (err) {
    console.log(err);
    return res.status(500).send('Something went wrong');
  }
};

// router.put('/profile/:id/toggle-activation-status', );
export const toggleActivationStatus = async (req, res) => {
  // TODO logic to avoid activation if deactivated by superadmin
  // const tokenData = extractToken(req);
  try {
    const { id } = req.params;

    const organization = await DB('events')
      .select('is_active as isActivated')
      .where('id', id)
      .first();

    await DB('events')
      .update({ is_active: !organization.isActivated })
      .where('id', id);
    return res.status(200).send();
  } catch (err) {
    console.log(err);
    return res.status(500).send('Something went wrong');
  }
};
