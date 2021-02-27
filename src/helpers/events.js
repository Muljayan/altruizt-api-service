export const getEventsPreviewData = async (event, DB) => {
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

  return {
    ...event,
    categories: eventCategories,
    beneficiaries: eventbeneficiaries,
    mainOrganizer,
    organizers: eventOrganizers,
    progress,
  };
  // responseData.push();
};

export default {
  getEventsPreviewData,
};
