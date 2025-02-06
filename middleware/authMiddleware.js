// Import user model
const User = require('../models/user/user');

const isAuthenticated = async (req, res, next) => {
    // Check if the user is logged in
    if (!req.session.userId) {
        console.log('inside checking session')
        return res.redirect('/login'); // User is not authenticated, redirect to login
    }
    
    try {
        console.log('inside try')
        const user = await User.findById(req.session.userId);
        
        // Check if the user exists
        if (!user) {
            return res.status(404).send('User not found');
        }

        // Check if the user is blocked
        if (user.status === 'Blocked' || user.isBlocked) { // Ensure consistent checking
            return res.redirect('/blocked'); // Redirect to a blocked page
        }

        next(); // User is authenticated and active, proceed to the next middleware/route

    } catch (error) {
        console.error('Error fetching user data:', error);
        return res.status(500).send('Server error');
    }
};


const isAdminAuthenticated = async (req, res, next) => {
    try {
        // Check if the user is logged in as an admin
        if (!req.session.isAdmin) {
            return res.redirect('/admin/login');
        }

        // If admin is logged in, proceed to the next middleware/route
        next();
    } catch (error) {
        console.error('Error in admin authentication middleware:', error);
        return res.status(500).send('Server error');
    }
};




module.exports = {
    isAuthenticated,
    isAdminAuthenticated
};
