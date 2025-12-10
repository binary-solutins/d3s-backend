const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendEmail = async (to, subject, text, html) => {
  await transporter.sendMail({
    from: `"D3S App" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    text: text || (html ? html.replace(/<[^>]*>/g, '') : ''),
    html: html || text,
  });
};

module.exports = sendEmail;
