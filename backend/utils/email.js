const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

exports.sendEmail = async ({ to, subject, html }) => {
  try {
    await transporter.sendMail({
      from: `MediLink <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });
  } catch (err) {
    console.error('Email error:', err.message);
  }
};

exports.prescriptionProcessedTemplate = (name, prescriptionId) => `
  <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
    <h2 style="color:#0ea5e9">MediLink - Prescription Processed</h2>
    <p>Hi ${name},</p>
    <p>Your prescription has been successfully processed by our AI engine.</p>
    <p><strong>Prescription ID:</strong> ${prescriptionId}</p>
    <p>Please log in to review the extracted medicines and request quotations.</p>
    <a href="${process.env.CLIENT_URL}/prescriptions/${prescriptionId}" 
       style="background:#0ea5e9;color:white;padding:10px 20px;border-radius:5px;text-decoration:none">
      View Prescription
    </a>
  </div>
`;

exports.quotationReceivedTemplate = (name, pharmacyName, prescriptionId) => `
  <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
    <h2 style="color:#0ea5e9">MediLink - New Quotation Received</h2>
    <p>Hi ${name},</p>
    <p><strong>${pharmacyName}</strong> has submitted a quotation for your prescription.</p>
    <a href="${process.env.CLIENT_URL}/prescriptions/${prescriptionId}" 
       style="background:#0ea5e9;color:white;padding:10px 20px;border-radius:5px;text-decoration:none">
      View Quotation
    </a>
  </div>
`;
