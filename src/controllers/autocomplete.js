import DB from '../config/database';

/**
 * @route POST /autocomplete/resources
 * @description Get all resources for autocomplete functionality
 * @access   Public
 */
export const getResources = async (req, res) => {
  try {
    const {
      text,
    } = req.body;

    const fmtText = text.toString().trim().toLowerCase();
    let resources = [];
    if (fmtText) {
      resources = await DB('resources')
        .where('name', 'like', `${fmtText}%`)
        .limit(500);
    }

    return res.status(200).send(resources);
  } catch (err) {
    console.log(err);
    return res.status(400).send({ message: 'Invalid user inputs' });
  }
};
/**
 * @route POST /autocomplete/getCategories
 * @description Get all categories for autocomplete functionality
 * @access   Public
 */
export const getCategories = async (req, res) => {
  try {
    const {
      text,
    } = req.body;

    const fmtText = text.toString().trim().toLowerCase();
    let categories = [];
    if (fmtText) {
      categories = await DB('categories')
        .where('name', 'like', `${fmtText}%`)
        .limit(500);
    }

    return res.status(200).send(categories);
  } catch (err) {
    console.log(err);
    return res.status(400).send({ message: 'Invalid user inputs' });
  }
};

export default {
  getResources,
};
