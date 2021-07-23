import nodemailer from 'nodemailer';
import {
  SMTP_HOST, SMTP_MAIL, SMTP_PASSWORD, SMTP_PORT,
} from '../config/secrets';

const sendEmail = async (email, subject, message) => {
  if (SMTP_HOST && SMTP_MAIL && SMTP_PASSWORD && SMTP_PORT && email && message) {
    try {
      const transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: true,
        auth: {
          user: SMTP_MAIL,
          pass: SMTP_PASSWORD,
        },
      });
      const info = await transporter.sendMail({
        from: `"Altruizt Platform " <${SMTP_MAIL}>`, // sender address
        to: email, // list of receivers
        subject, // Subject line

        html: `
        <p>${message}</p>
        <br />
        <p>DISCLAIMER</p>
        <p>Please note these emails are generated from a prototype application Altruizt which is in partial fulfillment of the requirements of the Degree of Bachelor of Information awarded by the Faculty of Information Technology, University of Moratuwa </p>
        <p>If you did not sign up for the system your email was probably used by chance by some tester. Do not worry, It is just a testing platform.</p>
        `, // html body
      });
      console.log('Message sent: %s', info.messageId);
    } catch (err) {
      console.log('Message not sent!');
    }
  } else {
    console.log('Message not sent!');
  }
};

export default sendEmail;
