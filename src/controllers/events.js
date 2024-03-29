import { promises as fs } from 'fs';

import DB from '../config/database';

import extractToken from '../utils/extractToken';
import { getEventProgress, getEventsPreviewData } from '../helpers/events';
import { imageExtractor } from '../utils/extractors';
import { EVENT_IMAGE_DIRECTORY } from '../config/directories';
import { FLAG_LIMIT } from '../config/settings';
import sendEmail from '../utils/email';

// router.post('/create', async (req, res) => {
export const createEvent = async (req, res) => {
  const trx = await DB.transaction();
  try {
    const tokenData = extractToken(req);
    const { organization } = tokenData;

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
      return res.status(400).send({ message: 'Resources needed not added' });
    }
    if (beneficiaries.length < 1) {
      trx.rollback();
      return res.status(400).send({ message: 'Beneficiaries not added' });
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
    return res.status(400).send({ message: 'Invalid user inputs' });
  }
};

// router.put('/profile/:id/update'
export const updateEventProfile = async (req, res) => {
  const { id } = req.params;
  const trx = await DB.transaction();
  try {
    const tokenData = extractToken(req);
    const { organization } = tokenData;
    const completionEligibility = await trx('events as e')
      .where('e.id', id)
      .where('e.main_organizer_id', organization.id)
      .select('e.is_complete as isComplete')
      .first();

    if (!completionEligibility || completionEligibility.isComplete) {
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
      return res.status(400).send({ message: 'Resources needed not added' });
    }
    if (beneficiaries.length < 1) {
      trx.rollback();
      return res.status(400).send({ message: 'Beneficiaries not added' });
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
    return res.status(400).send({ message: 'Invalid user inputs' });
  }
};

// router.get('/profile/:id/closure'
export const getClosingData = async (req, res) => {
  const { id } = req.params;
  try {
    const tokenData = extractToken(req);
    const { organization } = tokenData;

    const checkIfMainOrganizer = await DB('events as e')
      .where('e.id', id)
      .where('e.main_organizer_id', organization.id)
      .first();

    if (!checkIfMainOrganizer) {
      return res.status(401).send({ message: 'Your cannot update this event!' });
    }

    const mainOrganization = await DB('users as u')
      .leftJoin('organizations as o', 'o.user_id', 'u.id')
      .select('o.id as value', 'u.name as label')
      .where('o.id', organization.id)
      .first();

    const collaborators = await DB('event_organizers as eo')
      .leftJoin('organizations as o', 'o.id', 'eo.organization_id')
      .leftJoin('users as u', 'u.id', 'o.user_id')
      .select('o.id as value', 'u.name as label')
      .where('eo.event_id', id);

    const organizers = [mainOrganization, ...collaborators];

    const resources = await DB('resources as r')
      .select(
        'r.id as id',
        'r.name as name',
        'err.quantity as quantityReceived',
        'ern.quantity as quantityNeeded',
        DB.raw('(err.quantity - ern.quantity) as quantityDifference'),
      )
      .leftJoin('event_resources_needed as ern', 'ern.resource_id', 'r.id')
      .leftJoin('event_resources_received as err', 'err.resource_id', 'r.id')
      .where('ern.event_id', id)
      .where('err.event_id', id)
      .orderBy('r.id');

    const { progress } = await getEventProgress(DB, id);
    const remainingResources = [];
    if (resources && resources.length > 0) {
      for await (const resource of resources) {
        if (resource.quantityDifference > 0) {
          remainingResources.push(resource);
        }
      }
    }

    const responseObject = {
      organizers,
      resources,
      progress,
      remainingResources,
    };
    return res.status(201).send(responseObject);
  } catch (err) {
    console.log(err);
    return res.status(400).send({ message: 'Invalid user inputs' });
  }
};

// post('/profile/:id/complete'
export const completeEvent = async (req, res) => {
  const { id } = req.params;
  const trx = await DB.transaction();
  const {
    transferToOrganization, closingNote, remainingResources, progress,
  } = req.body;
  try {
    const tokenData = extractToken(req);
    const { organization } = tokenData;
    const completionEligibility = await trx('events as e')
      .where('e.id', id)
      .where('e.main_organizer_id', organization.id)
      .select('e.is_complete as isComplete')
      .first();

    if (!completionEligibility || completionEligibility.isComplete) {
      trx.rollback();
      return res.status(401).send({ message: 'Your cannot update this event!' });
    }
    const transferOrganization = await trx('organizations as o')
      .leftJoin('users as u', 'u.id', 'o.user_id')
      .select('u.name as name', 'o.id as id', 'o.organization_type_id as organizationType')
      .where('o.id', transferToOrganization)
      .first();

    // Update event
    await trx('events')
      .where('id', id)
      .update({
        is_successful: !!(progress >= 100),
        is_complete: true,
      });

    if (remainingResources.length > 0 && transferToOrganization) {
      // Beneficiery
      if (transferOrganization.organizationType === 3) {
        // gets added as a log and taken by beneficiery
        const transferlogData = {
          event_id: id,
          entry: `Remaining tems sent to ${transferOrganization.name}`,
          date: new Date(),
        };
        await trx('event_logs')
          .insert(transferlogData);
      } else {
        // gets added to resources available pool
        for await (const resource of remainingResources) {
          const resourceAvailability = await trx('resources_available')
            .where('organization_id', transferOrganization.id)
            .where('resource_id', resource.id)
            .select('quantity', 'id')
            .first();
          if (resourceAvailability) {
            await trx('resources_available')
              .update({ quantity: resourceAvailability.quantity + resource.quantityDifference })
              .where('id', resourceAvailability.id);
          } else {
            await trx('resources_available')
              .insert({
                quantity: resource.quantityDifference,
                organization_id: transferOrganization.id,
                resource_id: resource.id,
              });
          }
        }
      }
    }

    // Add closing note
    if (closingNote) {
      const eventLogData = {
        event_id: id,
        entry: closingNote,
        date: new Date(),
      };
      await trx('event_logs')
        .insert(eventLogData);
    }
    trx.commit();
    return res.status(200).send({ message: 'Success' });
  } catch (err) {
    console.log(err);
    trx.rollback();
    return res.status(500).send({ message: 'Something went wrong!' });
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
      return res.status(404).send({ message: 'Event does not exist!' });
    }

    // Find event
    const event = await trx('events')
      .select('id', 'is_active as isActive', 'title', 'description', 'start_date as startDate', 'end_date as endDate', 'location',
        'contact_name as contactName', 'phone', 'bank_account_name as bankName', 'bank_account_number as bankNumber', 'bank_account_branch as bankBranch',
        'image', 'is_complete as isComplete',
        'main_organizer_id as mainOrganizer')
      .where('id', id)
      .first();

    if (!event) {
      trx.rollback();
      return res.status(404).send({ message: 'Event does not exist!' });
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
      .update({ count: (eventInteractions.count + 1) })
      .where('event_id', event.id);

    const { progress, eventResourcesProgress } = await getEventProgress(trx, id);

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
    return res.status(500).send({ message: 'Something went wrong' });
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
        'e.image as image', 'ei.count as interactions', 'e.is_complete as isComplete',
      )
      .join('event_resources_needed as ern', 'ern.event_id', 'e.id')
      .leftJoin('event_categories as ec', 'ec.event_id', 'e.id')
      .leftJoin('event_interactions as ei', 'ei.event_id', 'e.id')
      .where('e.is_active', true)
      .groupBy('e.id')
      .orderBy('interactions', 'asc');
      // .where('e.is_complete', false)

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
    return res.status(500).send({ message: 'Something went wrong' });
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
        'e.is_complete as isComplete', 'e.image as image',
      )
      .join('event_resources_needed as ern', 'ern.event_id', 'e.id')
      .join('event_followers as ef', 'ef.event_id', 'e.id')
      .leftJoin('event_categories as ec', 'ec.event_id', 'e.id')
      .where('e.is_active', true)
      .where('ef.user_id', user.id)
      // .where('e.is_complete', false)
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
    return res.status(500).send({ message: 'Something went wrong' });
  }
};

// get /events/profile/:id/pledges
export const getEventPledges = async (req, res) => {
  const { id } = req.params;
  const tokenData = extractToken(req);
  const { organization } = tokenData;

  try {
    const checkIfMainOrganizer = await DB('events as e')
      .where('e.id', id)
      .where('e.main_organizer_id', organization.id)
      .first();

    if (!checkIfMainOrganizer) {
      return res.status(401).send({ message: 'Your cannot get pledges for this event!' });
    }
    const pledges = await DB('event_pledges as ep')
      .leftJoin('users as u', 'u.id', 'ep.user_id ')
      .where('ep.event_id', id)
      .select('ep.id as id', 'u.name as name', 'ep.contact_number as phone', 'contact_email as email');

    return res.status(200).send(pledges);
  } catch (err) {
    console.log(err);
    return res.status(500).send({ message: 'Something went wrong' });
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
    return res.status(500).send({ message: 'Something went wrong' });
  }
};

export const upvote = async (req, res) => {
  const { id } = req.params;
  const tokenData = extractToken(req);
  const { user } = tokenData;
  const trx = await DB.transaction();
  try {
    const ratings = await trx('event_ratings')
      .where('user_id', user.id)
      .where('event_id', id)
      .select('value')
      .first();
    if (ratings) {
      // remove
      if (Number(ratings.value) === 1) {
        await trx('event_ratings')
          .where('user_id', user.id)
          .where('event_id', id)
          .update({ value: 0 });
      } else {
        await trx('event_ratings')
          .where('user_id', user.id)
          .where('event_id', id)
          .update({ value: 1 });
      }
    } else {
      // add
      const ratingData = { user_id: user.id, event_id: id, value: 1 };
      await trx('event_ratings')
        .insert(ratingData);
    }
    const eventInteractions = await trx('event_interactions')
      .select('count')
      .where('event_id', id)
      .first();
    await trx('event_interactions')
      .update({ count: (eventInteractions.count + 1) })
      .where('event_id', id);
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
    const ratings = await trx('event_ratings')
      .where('user_id', user.id)
      .where('event_id', id)
      .select('value')
      .first();
    if (ratings) {
      // remove
      if (Number(ratings.value) === -1) {
        await trx('event_ratings')
          .where('user_id', user.id)
          .where('event_id', id)
          .update({ value: 0 });
      } else {
        await trx('event_ratings')
          .where('user_id', user.id)
          .where('event_id', id)
          .update({ value: -1 });
      }
    } else {
      // add
      const ratingData = { user_id: user.id, event_id: id, value: -1 };
      await trx('event_ratings')
        .insert(ratingData);
    }

    const eventRatingScore = await trx('events as e')
      .leftJoin('organizations as o', 'o.id', 'e.main_organizer_id')
      .leftJoin('users as u', 'u.id', 'o.user_id')
      .leftJoin('event_ratings as er', 'er.event_id', 'e.id')
      .sum('er.value as value')
      .select('e.id as id', 'u.email as email')
      .where('e.id', id)
      .groupBy('e.id')
      .first();
    if (Number(eventRatingScore.value) <= FLAG_LIMIT) {
      const message = 'Event deactivated, flagged too many times. Contact the super admin!';
      await trx('events')
        .update({
          is_active: false,
          superadmin_deactivation: true,
          deactivation_reason: message,
        })
        .where('id', id);
      await sendEmail(eventRatingScore.email, `Your event #${id} has been flagged`, message);
    }
    const eventInteractions = await trx('event_interactions')
      .select('count')
      .where('event_id', id)
      .first();
    await trx('event_interactions')
      .update({ count: (eventInteractions.count + 1) })
      .where('event_id', id);
    trx.commit();
    return res.status(200).send({ message: 'success' });
  } catch (err) {
    trx.rollback();
    console.log(err);
    return res.status(500).send({ message: 'Something went wrong' });
  }
};

// put /events/profile/:id/pledge
export const toggleEventPledge = async (req, res) => {
  try {
    const { id } = req.params;
    const { email, phone } = req.body;
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
      const pledgeData = {
        user_id: user.id,
        event_id: id,
        contact_number: phone || null,
        contact_email: email || null,
      };
      await DB('event_pledges')
        .insert(pledgeData);
    }
    return res.status(200).send({ message: 'success' });
  } catch (err) {
    console.log(err);
    return res.status(500).send({ message: 'Something went wrong' });
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
    return res.status(500).send({ message: 'Something went wrong' });
  }
};

// router.put('/profile/:id/toggle-activation-status', );
export const toggleActivationStatus = async (req, res) => {
  const tokenData = extractToken(req);
  try {
    const { reason } = req.body;
    const { id } = req.params;

    const event = await DB('events as e')
      .leftJoin('organizations as o', 'o.id', 'e.main_organizer_id')
      .leftJoin('users as u', 'u.id', 'o.user_id')
      .select(
        'e.is_active as isActivated',
        'e.superadmin_deactivation as superadminDeactivation',
        'u.email as email',
      )
      .where('e.id', id)
      .first();

    if (!tokenData.isSuperAdmin && event.superadminDeactivation) {
      return res.status(401).send({ message: 'The superadmin has deactivated your activation permission' });
    }

    if (tokenData.isSuperAdmin && event.isActivated) {
      // Super admin will deactivate
      await DB('events')
        .update({
          is_active: false,
          superadmin_deactivation: true,
          deactivation_reason: reason,
        })
        .where('id', id);
      // TODO email
      await sendEmail(event.email, `Your event #${id} has been deactivated`, reason);
    } else {
      await DB('events')
        .update({
          is_active: !event.isActivated,
          superadmin_deactivation: false,
          deactivation_reason: !event.isActivated ? reason : '',
        })
        .where('id', id);
    }

    return res.status(200).send();
  } catch (err) {
    console.log(err);
    return res.status(500).send({ message: 'Something went wrong' });
  }
};
