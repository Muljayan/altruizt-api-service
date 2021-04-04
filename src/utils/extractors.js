export const imageExtractor = (image) => {
  let extension;
  let fmtImg;
  switch (image.type) {
    case 'image/jpeg':
      extension = 'jpeg';
      fmtImg = image.value.replace(/^data:image\/jpeg;base64,/, '');
      break;
    case 'image/jpg':
      extension = 'jpg';
      fmtImg = image.value.replace(/^data:image\/jpg;base64,/, '');
      break;
    case 'image/png':
      extension = 'png';
      fmtImg = image.value.replace(/^data:image\/png;base64,/, '');
      break;
    default:
      extension = 'jpeg';
      fmtImg = image.value.replace(/^data:image\/jpeg;base64,/, '');
  }
  return {
    extension,
    fmtImg,
  };
};

export const random = (e) => e;
