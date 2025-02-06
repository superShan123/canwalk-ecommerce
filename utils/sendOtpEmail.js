const nodemailer = require('nodemailer');
const dotenv = require('dotenv')
require('dotenv').config(); // Ensure you load environment variables

const sendOtpEmail = (email, otp) => {
    // Create transporter using your email service and credentials
    const transporter = nodemailer.createTransport({
        service: 'gmail', // Use your email service provider
        auth: {
            user:  process.env.EMAIL_USER,// Your email address
            pass: process.env.EMAIL_PASS,  // Your email password or app-specific password
        }
    }); 

    const mailOptions = {
        from: "canwalkproject@gmail.com", // Sender address
        to: email,                    // Recipient's email
        subject: 'Your OTP Code',
        text: `Your OTP code is: ${otp}`, // Email content
    };

    // Send the email
    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.error("Error sending OTP email:", error);
        } else {
            console.log("OTP sent successfully:", info.response);
            console.log(info.response)
        }
    });
};

module.exports = {
    sendOtpEmail
}


