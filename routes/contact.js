const express = require('express');
const { transporter } = require("../config/mailer");
const router = express.Router();

const escapeHtml = (unsafe) =>
    String(unsafe)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

router.post('/', (req, res) => {
    const { name, email, phone, subject, message } = req.body || {};

    console.log('Received contact form submission:', { name, email, phone, subject, message });

    if (!name || !email || !message) {
        return res.status(400).json({ success: false, message: 'Missing required fields: name, email, message' });
    }

    const mailOptions = {
        from: process.env.EMAIL_USER,
        replyTo: email,
        to: 'rvk.its@psgtech.ac.in', // Replace with your email address
        subject: `New Contact Form Submission from ${name} - ${subject || 'No Subject'}`,
        text: `Name: ${name}\nEmail: ${email}\nPhone: ${phone || 'N/A'}\nSubject: ${subject || 'No Subject'}\n\n${message}`,
        html: `
            <h2>New Contact Form Submission</h2>
            <p><strong>Name:</strong> ${escapeHtml(name)}</p>
            <p><strong>Email:</strong> ${escapeHtml(email)}</p>
            <p><strong>Phone:</strong> ${escapeHtml(phone || 'N/A')}</p>
            <p><strong>Subject:</strong> ${escapeHtml(subject || 'No Subject')}</p>
            <p><strong>Message:</strong></p>
            <p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>
        `,
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.error('Error sending email:', error);
            return res.status(500).json({ success: false, message: 'Failed to send email' });
        }
        console.log('Email sent:', info.response);
        res.json({ success: true, message: 'Email sent successfully' });
    });
});
module.exports = router;
