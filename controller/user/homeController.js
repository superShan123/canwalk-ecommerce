const dotenv = require('dotenv');
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");
const otpController = require("./otpController");
const sendOtp = require('../../utils/sendOtpEmail');
const userDB = require("../../models/user/user");
const Product = require('../../models/admin/product');
const Category = require('../../models/admin/category');
const {body,validationResult} = require('express-validator')
const Order = require('../../models/user/order')
const Offer = require('../../models/admin/offer')



dotenv.config();

const getHome = async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.render('home/index')
        }

        const user = await userDB.findById(req.session.userId);
        

        if (!user) {
            req.session.destroy((err) => {
                if (err) console.error('Session destruction error:', err);
                return res.redirect('/login');
            })
            return;
        }

        if (user.isBlocked) {
            req.session.destroy((err) => {
                if (err) console.error('Session destruction error:', err);
                return res.render('blocked', { error: 'Your account is blocked' });
            });
            return;
        }

        res.render("home/index");
        
    } catch (error) {
        console.error("Error fetching user:", error);
        res.status(500).send("An error occurred");
    }
};


const getSignup = (req, res) => {
    let errors = []
    res.render("home/signup",{errors});
};


const postSignup = async (req, res) => {
    try {
        const { username, email, password, confirmPassword } = req.body;
        const errors = [];

        // Validation checks
        if (!username || !email || !password || !confirmPassword) {
            errors.push("All fields are required.");
        }
        if (password !== confirmPassword) {
            errors.push("Passwords do not match.");
        }
        const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{6,}$/;

        if (!passwordRegex.test(password)) {
            errors.push(
                "Password must contain at least one letter, one number, one special character, no spaces, and be at least 6 characters long."
            );
        }
        
        if (password.length < 6) {
            errors.push("Password must be at least 6 characters long.");
        }

        
        const existingEmail = await userDB.findOne({ email });
        if (existingEmail) {
            errors.push("Email is already registered.");
        }

        const existingUsername = await userDB.findOne({username});
        if(existingUsername){
            errors.push('Username already exist')
        }

        // If errors exist, return errors as JSON
        if (errors.length > 0) {
            return res.status(400).json({ success: false, error: errors.join(" ") });
        }

        // Hash the password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Generate OTP
        const otp = otpController.generateOtp();

        // Store temporary user data in session
        req.session.tempUser = {
            username,
            email,
            password: hashedPassword,
            otp,
        };

        // Send OTP email
        await sendOtp.sendOtpEmail(email, otp);

        // Redirect to OTP page
        return res.status(200).json({ success: true });
    } catch (err) {
        console.error("Error during signup process:", err);
        return res.status(500).json({ success: false, error: "An error occurred, please try again." });
    }
};         

const getLogin = (req, res) => {
    res.render('home/login');
};

const postLogin = async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await userDB.findOne({ username });

        if (!user) {
           
            return res.render('home/login', { error: 'User does not exist. Please sign up.' });
        }

        if (user.status == "inactive") {
            req.session.destroy((err) => {
                if (err) console.error('Session destruction error:', err);
                return res.render('home/login', { error: 'Your account is blocked' });
            });
            return;
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.render('home/login', { error: 'Incorrect password' });
        }

    // Save user data in session
    req.session.userId = user._id;
    console.log('Session:', req.session);

 res.redirect('/')

    } catch (error) {
        console.error("Error during login:", error);
        res.render('/login', { error: 'An error occurred during login. Please try again.' });
    }
};




const getUserProducts = async (req, res) => {
    try {
    
        // Fetch active categories
        const activeCategories = await Category.find({ status: 'active' });

        if (!activeCategories || activeCategories.length === 0) {
         
            return res.render('home/productlist', { products: [], currentPage: 1, totalPages: 1 });
        }

        // Pagination logic start
        let currentPage = parseInt(req.query.page) || 1;

        const pageSize = 7; 
        const skip = (currentPage - 1) * pageSize 
    
        const products = await Product.find({
            status: 'active',
            category: { $in: activeCategories.map(cat => cat._id) }
        })
        .skip(skip)
        .limit(pageSize)
        .populate('category', 'name status');

        const totalProducts = await Product.countDocuments({ status: 'active' });
        const totalPages = Math.ceil(totalProducts / pageSize);

        const productwithDiscount = products.map(product=>{
            const discount = product.discount ||0;
            const discountPrice = product.price-(product.price*discount )/100;
           
            return{
                ...product._doc,
                discountPrice: discountPrice.toFixed(2),
                orginalPrice:product.price.toFixed(2),
                discountPercentage: discount>0?`-${discount}%`: null,
            }
        })

        res.render('home/productlist', {
            products:productwithDiscount, 
            currentPage, // Pass current page number
            totalPages,
            
        });
    } catch (err) {
        console.error('Error fetching products for user:', err);
        res.status(500).render('error', { message: 'Error fetching products' });
    }
};


const getProductDetails = async (req, res) => {
    const productId = req.params.id;
    try {
        const product = await Product.findById(productId)
            .select('name quantity price description color size status productImages discount averageRating totalRatings stock images highlights category')
            .populate('category', 'name status');

        if (!product || product.status === 'inactive' || product.category.status === 'inactive') {
            return res.render('home/productdetails', { product: null, message: 'This product is currently unavailable' });
        }

        let offer = await Offer.findOne({
            category: product.category._id,
            expiryDate: { $gte: new Date() },
        }) || null;

        const price = product.price || 0;
        let discountedPrice = price;
        let appliedOffer = null;

        if (offer) {
            // Apply category offer first
            if (offer.discountType === 'percentage') {
                discountedPrice = price * (1 - offer.discountValue / 100);
            } else if (offer.discountType === 'flat') {
                discountedPrice = price - offer.discountValue;
            }
            appliedOffer = 'Category Offer';
        } else if (product.discount > 0) {
            // Apply product discount only if no category offer exists
            discountedPrice = price * (1 - product.discount / 100);
            appliedOffer = 'Product Discount';
        }

        res.render('home/productdetails', {
            product,
            discountedPrice,
            offer,
            appliedOffer,
            message: '',
        });

    } catch (error) {
        console.error('Error fetching products for user:', error);
        res.status(500).render('error', { message: 'Error fetching products' });
    }
};




const postProductDetails = async (req, res) => {
    try {
        
        const newProduct = new Product({
            name: req.body.name,
            quantity: req.body.quantity,
            description: req.body.description,
            color: req.body.color,
            size: req.body.size,
            price: req.body.price,
            discount: req.body.discount || 0,
            images: Array.isArray(req.body.images) ? req.body.images : [req.body.images],
            category: Array.isArray(req.body.category) ? req.body.category : [req.body.category],
            status: req.body.status,
            averageRating: req.body.averageRating,
             totalRatings : req.body.totalRatings,
            productImages: Array.isArray(req.body.productImages) ? req.body.productImages : [req.body.productImages],
            highlights: req.body.highlights || [],
            createdAt: req.body.createdAt || new Date(),
        });

        await newProduct.save();

        res.status(201).json({ message: 'Product added successfully', product: newProduct });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error adding product' });
    }
};

const getUserCategories = async (req,res)=>{
    const categoryId = req.params.id

    try{
         res.redirect('/product')
    }catch(err){
         res.status(500).send('Internal server error')
    }

}


const productQuantity = async (req,res)=>{
    try{
        const product = await Product.findById(req.params.id).select('quantity');
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
          }
          res.json(product);
    }catch(err){
        console.error('Error fetching product stock:', error);
    res.status(500).json({ message: 'Server error' }); 
    }
}


const getforgotPassword = async (req,res)=>{
    res.render('home/forgot-password')
}


const forgotPassword = async (req, res) => {
    const { email } = req.body;

    try {
        const user = await userDB.findOne({ email });
        if (!user) {
            return res.render('home/forgot-password',{error:'User not found!'})
        }

        const otp = Math.floor(100000 + Math.random() * 900000);

        req.session.resetemail = email;
        req.session.otp = otp;

        const transporter = nodemailer.createTransport({
            service: 'Gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });

        const mailOptions = {
            to: email,
            subject: 'Password Reset',
            text: `Your OTP for password reset is: ${otp}`,
        };

        console.log('Mail Options:', mailOptions);

        await transporter.sendMail(mailOptions);
        console.log('Email sent successfully');
        res.redirect('/otp-verify')
    } catch (err) {
        console.error('Error occurred:', err);
        res.status(500).send('An error occurred');
    }
};



const resetPassword = async (req,res)=>{

const {newPassword, confirmPassword} = req.body;

try{
    const email = req.session.resetemail
    const user = await userDB.findOne({email})

    if(!user){
        return res.status(400).send('User not found')
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    user.password = hashedPassword;
    await user.save()

    res.redirect('/login')
}catch(err){
    res.status(500).send('Error occured while reseting')
}}


const getresetPassword = async (req,res)=>{
    res.render('home/reset-password')
}




const otpVerify = async (req,res)=>{
    const {otp} = req.body;

    try{
        if(otp === req.session.otp.toString()){
            req.session.isVerified = true;
            res.redirect('/reset-password')
        }else{
            res.render('home/verify-otp',{error:'Otp is incorrect'})
        }
    }catch(err){
        console.error('Error fetching',err)
        res.status(500).send('Internal server error')

    }
}


const getOtpVerify = async (req,res)=>{
    res.render('home/verify-otp')
}



const submitRating = async (req, res) => {
    const { orderId, rating } = req.body;

    console.log('Received orderId:', orderId);  // Log orderId

    try {
        

        // Check the orderId format before the query
        const order = await Order.findById( orderId );
        if (!order) {
            console.log('Order not found with orderId:', orderId);
            return res.status(404).send('Order not found');
        }


        const productId = order.items[0].productId


        // Update the order rating
         const updatedOrder = await Order.findOneAndUpdate(
            { _id: orderId },  
            { $set: { "returnDetails.orderRating": parseInt(rating) } },
            { new: true }
        );

        if (!updatedOrder) {
            console.log('Failed to update order with orderId:', orderId);
            return res.status(500).send('Failed to update order');
        }

        const product = await Product.findById(productId);

        if(!product){
            return res.status(404).send('Product not found')
        }

        const newTotalRatings = product.totalRatings + 1;
        const newAverageRating = (product.averageRating * product.totalRatings + rating) / newTotalRatings

       const updateProduct=  await Product.findByIdAndUpdate(productId,{
            $set:{
                averageRating: newAverageRating.toFixed(1),
                totalRatings: newTotalRatings,
            }
        });



        if(!updateProduct){
            console.log('Failed to update product');
            return res.status(500).send('Failed to update product')
        }

        const ratingSubmitted = true;

        console.log('Updated Product Details:', updateProduct);
        res.render('home/order-track', { ratingSubmitted, order });
    } catch (err) {
        console.error('Error submitting rating:', err);
        res.status(500).send('Unable to save rating.');
    }
};


const getLogout = async (req,res)=>{
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).send('Failed to log out');
        }
        res.redirect('/login')
    });
}


// Exporting the controller functions
module.exports = {
    getHome,
    getSignup,
    getLogin,
    postSignup,
    postLogin,
    getUserProducts,
    getProductDetails,
    postProductDetails,
    getUserCategories,
    productQuantity,
    forgotPassword,
    resetPassword,
    getforgotPassword,
    getresetPassword,
    otpVerify,
    getOtpVerify,
    submitRating,
    getLogout
    
};



