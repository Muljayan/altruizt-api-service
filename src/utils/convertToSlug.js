const convertToSlug = (text) => text
  .toLowerCase()
  .replace(/[^\w ]+/g, '')
  .replace(/ +/g, '-');

export default convertToSlug;
