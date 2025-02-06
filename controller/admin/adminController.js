const User = require("../../models/user/user");
const Category = require('../../models/admin/category');
const mongoose = require('mongoose');
const Order = require('../../models/user/order')
const Product = require('../../models/admin/product')
const Coupon = require('../../models/user/coupon')




// Admin Login Get Method

const getAdminLogin = (req, res) => {
    res.render('admin/login',{error: undefined});
};



// Admin Login Post Method 

const postAdminLogin = async (req, res) => {
    try {
        const { username, password } = req.body;
        
        const adminUsername = 'admin';
        const adminPassword = 'admin123';

        if (username === adminUsername && password === adminPassword) {
            req.session.isAdmin = true;
           res.redirect('/admin/dashboard');

        } else {
            res.render('admin/login',{error:'Incorrect username and password'})
        }

    } catch (error) {
        console.error("Error during login:", error);
        res.status(500).send("Error during login.");
    }
};


const getAdminDashboard = async (req, res) => {
    console.log("getAdminDashboard function called");

    try {
        const { year, week } = req.query;

        // Validate year and week format
        if (year && !/^\d{4}$/.test(year)) {
            return res.status(400).json({ error: "Invalid year format" });
        }
        if (week && !/^\d{1,2}$/.test(week)) {
            return res.status(400).json({ error: "Invalid week format" });
        }

        const matchCondition = {};
        if (year) {
            const startOfYear = new Date(`${year}-01-01T00:00:00.000Z`);
            const endOfYear = new Date(`${year}-12-31T23:59:59.999Z`);
            matchCondition.createdAt = { $gte: startOfYear, $lte: endOfYear };
        }

        if (week) {
            const startOfWeek = new Date(year, 0, (week - 1) * 7 + 1); // Week starts on Monday
            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(startOfWeek.getDate() + 6); // End of the week
            matchCondition.createdAt = { $gte: startOfWeek, $lte: endOfWeek };
        }

        console.log("Match Condition:", matchCondition);

        const yearlySales = await Order.aggregate([
            { $match: matchCondition },
            {
                $group: {
                    _id: { month: { $month: "$createdAt" } },
                    totalSales: { $sum: "$orderSummary.total" },
                },
            },
            { $sort: { "_id.month": 1 } },
        ]);

        console.log("Yearly Sales Aggregation Result:", yearlySales);

        const totalCustomers = await User.countDocuments();
        const totalOrders = await Order.countDocuments();
        const totalRevenue = await Order.aggregate([
            { $group: { _id: null, totalRevenue: { $sum: "$orderSummary.total" } } },
        ]);
        const totalRevenueValue = totalRevenue[0]?.totalRevenue || 0;

        const ordersToday = await Order.countDocuments({
            createdAt: { $gte: new Date().setHours(0, 0, 0, 0) },
        });

        const ordersThisWeek = await Order.countDocuments({
            createdAt: {
                $gte: new Date(new Date().setDate(new Date().getDate() - 7)), // 7 days ago
                $lt: new Date(), // To ensure it's before the current date
            },
        });

        console.log('orders of week', ordersThisWeek);

        const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1); // First day of the month at midnight
        const ordersThisMonth = await Order.countDocuments({
            createdAt: {
                $gte: startOfMonth, // Start of the current month
                $lt: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59, 999), // End of the month
            },
        });

        console.log('orders of months', ordersThisMonth);

        // Fetch Best Selling Products

        console.log("Before fetching best-selling products");
        const bestSellingProducts = await Order.aggregate([
            { $unwind: '$items' },
            {
                $group: {
                    _id: '$items.productId',
                    totalQuantity: { $sum: '$items.quantity' },
                },
            },
            {
                $lookup: {
                    from: 'products',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'productDetails',
                },
            },
            { $unwind: '$productDetails' },
            { $sort: { totalQuantity: -1 } },
            { $limit: 10 },
        ]);

        console.log("Best Selling Products:", bestSellingProducts); // Added log for debugging

        // Fetch Best Selling Categories
        const bestSellingCategories = await Order.aggregate([
            { $unwind: '$items' },
            {
                $lookup: {
                    from: 'products',
                    localField: 'items.productId',
                    foreignField: '_id',
                    as: 'productDetails',
                },
            },
            { $unwind: '$productDetails' },
            {
                $group: {
                    _id: '$productDetails.category',
                    totalSales: { $sum: '$items.quantity' },
                },
            },
            {
                $lookup: {
                    from: 'categories',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'categoryData',
                },
            },
            { $unwind: '$categoryData' },
            { $sort: { totalSales: -1 } },
            { $limit: 10 },
        ]);

        console.log("Best Selling Categories:", bestSellingCategories); // Added log for debugging

        if (req.headers.accept && req.headers.accept.includes("application/json")) {
            console.log('inside the if condition for sending the application/json');
            return res.json({
                stats: {
                    totalCustomers,
                    totalOrders,
                    totalRevenue: totalRevenueValue,
                    ordersToday,
                    ordersThisWeek,
                    ordersThisMonth,
                },
                yearlySales,
            });
        } else {
            console.log('this is inside the else condition');
            res.render("admin/dashboard", {
                stats: {
                    totalCustomers,
                    totalOrders,
                    totalRevenue: totalRevenueValue,
                    ordersToday,
                    ordersThisWeek,
                    ordersThisMonth,
                    bestSellingProducts: bestSellingProducts || [],
                    bestSellingCategories: bestSellingCategories || [],
                },
                yearlySales,
            });
        }
    } catch (err) {
        console.error("Error in getAdminDashboard:", err);
        res.status(500).json({ error: "Internal server error" });
    }
};


  

// Admin Logout
const adminLogout = (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).send('Error during logout')
        }
        res.redirect('/admin/login');
    });
};

// Get Admin Customers
const getAdminCustomer = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 12;

        const skip = (page-1)*limit;

        const customers = await User.find().skip(skip).limit(limit);

        const totalCustomers = await User.countDocuments()

        const totalPages = Math.ceil(totalCustomers/ limit)
       

        // Directly passing the customers array to the view
        res.render('admin/customers', 
            { customerDetails: customers,
                currentPage : page,
                totalPages : totalPages,
                totalCustomers: totalCustomers,
                limit
             });
    } catch (error) {
        console.error("Error fetching customers:", error);
        res.status(500).send('Internal Server Error');
    }
};

// Toggle User Status (Block/Unblock)
const toggleUserStatus = async (req, res) => {
    
    const userId = req.params.userId;
    const { status } = req.body;


    console.log('Request received:', req.method, req.originalUrl);  // Log method and URL
    console.log('User ID:', req.params.userId);
    console.log('Request Body:', req.body);  

    // Log the status

    try {
        const user = await User.findById(userId);
        console.log(user)
        if (!user) {
            return res.status(404).send({ message: 'User not found' });
        }

        user.status = status;
        await user.save();
        res.redirect('/admin/customers');
    } catch (error) {
        console.error('Error during status toggle:', error);
        res.status(500).send('Internal server Error');
    }
};





module.exports = {
    getAdminLogin,
    postAdminLogin,
    getAdminDashboard,
    adminLogout,
    getAdminCustomer,
    toggleUserStatus
};
