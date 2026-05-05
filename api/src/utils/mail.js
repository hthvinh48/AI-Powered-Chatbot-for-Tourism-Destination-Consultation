const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

exports.sendResetPasswordEmail = async (email, link) => {
  await transporter.sendMail({
    from: `"Travel Planner" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Reset Password",
    html: `
      <h2>Password Reset</h2>
      <p>Click the link below to reset password:</p>
      <a href="${link}">${link}</a>
      <p>This link expires in 15 minutes</p>
    `,
  });
};
