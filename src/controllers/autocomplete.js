import DB from '../config/database';

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
    return res.status(400).send('Invalid user inputs');
  }
};

export default {
  getResources,
};
