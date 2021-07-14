const emailAvailable = true;

const sendEmail = async (email, subject, message) => {
  if (emailAvailable) {
    console.log(email, subject, message);
  }
};

export default sendEmail;
