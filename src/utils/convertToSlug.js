const convertToSlug = (text) => text
  .toLowerCase()
  .replace(/[^\w ]+/g, '')
  .replace(/ +/g, '-');

module.exports = convertToSlug;
