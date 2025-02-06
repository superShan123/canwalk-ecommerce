const Wallet = require('../../models/user/wallet')
const Order = require('../../controller/user/order')
const bcrypt = require('bcrypt')
const userDB = require("../../models/user/user");


const getWallet = async (req, res) => {
    try {
        const userId = req.session.userId;
        if (!userId) {
            return res.status(400).send('User not found');
        }

        const wallet = await Wallet.findOne({ userId });

        if (wallet) {
            // Sorting transactions
            wallet.transactions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        }

        const page = parseInt(req.query.page) || 1; // Default to page 1 if not provided
        const limit = parseInt(req.query.limit) || 5; // Default to 10 transactions per page

        // Calculate pagination
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;

        const transactions = wallet
            ? wallet.transactions.slice(startIndex, endIndex) // Paginate transactions
            : [];

        const totalTransactions = wallet ? wallet.transactions.length : 0;

        const pagination = {
            currentPage: page,
            totalPages: Math.ceil(totalTransactions / limit),
            hasNextPage: endIndex < totalTransactions,
            hasPreviousPage: startIndex > 0,
        };

        const newwallet = wallet || { transactions: [] };

        res.render('home/wallet', {
            newwallet: { ...newwallet, transactions },
            pagination, // Pass pagination data to the frontend
        });
    } catch (err) {
        console.error('Error fetching the wallet', err);
        res.status(500).send('Internal server error');
    }
};


const changePassword = async (req, res) => {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const userId = req.session.userId;

    if (!userId) {
        return res.redirect('/login');  
    }

    if (!currentPassword || !newPassword || !confirmPassword) {
        return res.render('home/res-password', { error: 'All fields are required' });
    }

    try {
        const user = await userDB.findById(userId);
        if (!user) {
            return res.render('home/res-password', { error: 'User not found. Please log in again.' });
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.render('home/res-password', { error: 'Current password is incorrect.' });
        }

        // Updated password validation: No spaces, 8-16 chars, at least 1 letter, 1 number, 1 special character
        const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,16}$/;
        
        if (!passwordRegex.test(newPassword)) {
            return res.render('home/res-password', { error: 'Password must be 8-16 characters, contain at least one letter, one number, and one special character, and have no spaces.' });
        }

        if (newPassword !== confirmPassword) {
            return res.render('home/res-password', { error: 'New passwords do not match.' });
        }

        if (newPassword === currentPassword) {
            return res.render('home/res-password', { error: 'New password cannot be the same as the current password.' });
        }
        

        const hashedPassword = await bcrypt.hash(newPassword, 12);
        user.password = hashedPassword;
        await user.save();

        return res.render('home/res-password', { success: 'Password updated successfully' });


    } catch (error) {
        console.error('Error changing password:', error);
        return res.render('home/res-password', { error: 'An unexpected error occurred. Please try again later.' });
    }
};






module.exports = {
    getWallet,
    changePassword

}


