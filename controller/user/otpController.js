const userDB = require("../../models/user/user");
const {sendOtpEmail} = require("../../utils/sendOtpEmail");

// Function to generate a 6-digit OTP
const generateOtp = () => {
    const otp = Math.floor(100000 + Math.random() * 900000); // Generates a 6-digit OTP
    console.log("Generated OTP:", otp); // Debugging
    return otp;
};

// Function to render the OTP page
const renderOtpPage = (req, res, { success = null, error = null } = {}) => {
    const email = req.session?.tempUser?.email;
    const errors = error? [error]: []
    console.log("Data passed to OTP page:", { email, success, errors });
    res.render("home/otp", { email, success, errors });
};


const verifyOtp = async (req, res) => {
    const { otp } = req.body; // Get OTP from request body
    const tempUser = req.session?.tempUser; // Get the tempUser from session

    // Check if tempUser and sessionOtp exist
    if (!tempUser || !tempUser.otp) {
        return res.status(400).send("No OTP found in session. Please retry signup.");
    }

    const sessionOtp = tempUser.otp; // Get OTP from tempUser in session

    // Compare the OTP as strings to ensure proper match
    if (String(otp).trim() !== String(sessionOtp).trim()) {
        console.log('Invalid OTP');
        // Send error back with the countdown time to the frontend
        return res.status(400).json({sucess: false, message:'Invalid OTP'})
    }

    const { username, email, password } = tempUser;
    if (!username || !email || !password) {
        return res.status(400).json({ success: false, message: "Incomplete user data. Please retry signup." });
    }

    const newUser = new userDB({ username, email, password });

    try {
        await newUser.save(); // Save user to database
        req.session.tempUser = null;
        return res.status(200).json({ success: true, message: "OTP verified. Signup successful. Redirecting to login..." });
    } catch (error) {
        console.error('Error saving user to database', error);
        return res.status(500).json({ success: false, message: "Failed to save user. Please try again later." });
    }
};


// Function to resend OTP
const resendOtp = async (req, res) => {
    const email = req.session?.tempUser?.email;

    if (!email) {
        return res.status(400).json({ success: false, message: "No email found in session. Please retry signup." });
    }

    const newOtp = generateOtp();
    req.session.tempUser.otp = newOtp; // Update the session with the new OTP

    try {
        await sendOtpEmail(email, newOtp);
        console.log(`New OTP sent to ${email}`);
        return res.status(200).json({ success: true, message: "New OTP sent successfully." });
    } catch (error) {
        console.error("Error while sending OTP email:", error);
        return res.status(500).json({ success: false, message: "Failed to resend OTP. Please try again later." });
    }
};


// Export each function
module.exports = {
    generateOtp,
    renderOtpPage,
    verifyOtp,
    resendOtp
};
