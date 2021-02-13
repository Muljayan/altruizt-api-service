const express = require('express');
const DB = require('../config/database');

const router = express.Router();

router.post('/', async (req, res) => {
  console.log('/organizations');
  const { searchString, isBeneficiary, resources } = req.body;

  const searchedResources = resources.map((resource) => resource.value);

  try {
    const organizationsQuery = DB('organizations as o')
      .join('users as u', 'u.id', 'o.user_id')
      .groupBy('o.id')
      .select('o.id as id', 'u.name');

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
    console.log(organizations);

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

    // const responseData = {
    //   organizations,
    // };

    return res.status(200).send(responseData);
  } catch (err) {
    console.log(err);
    return res.status(500).send('Something went wrong');
  }
});

module.exports = router;
