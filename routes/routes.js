const express = require("express");
const router = express.Router();
const passport = require('passport')

// Import controllers
const userController = require("../controller/user/homeController");
const otpController = require("../controller/user/otpController");
const profileController = require("../controller/user/profile")
const cartController = require('../controller/user/cart')
const orderController = require('../controller/user/order')
const wishlistController = require('../controller/user/wishlist')
const couponController = require('../controller/admin/coupon')
const walletController = require('../controller/user/wallet')


// Home Route
const { isAuthenticated, isAdminAuthenticated } = require("../middleware/authMiddleware")

router.get("/",isAuthenticated, userController.getHome);

// Signup Routes
router.get("/signup", userController.getSignup); 
router.post("/signup",userController.postSignup)       // Render signup form


// login route
router.get('/login', userController.getLogin)
router.post('/login',userController.postLogin)


router.get('/logout',isAuthenticated,userController.getLogout)


// OTP Routes
router.post("/verify-otp", otpController.verifyOtp);    // OTP verification
router.get("/resend-otp", otpController.resendOtp);     // Resend OTP

// OTP Page Route - render the OTP form
router.get("/otp", (req, res) => {
    const email = req.session?.tempUser?.email; // Retrieve email from session

    // Check if tempUser or email is undefined
    if (!email) {
        return res.redirect("/signup"); // Redirect to signup if no session data
    }

    // Render OTP page with email, and pass null as the default error
    res.render("home/otp", { email,  success:null,error: null });
});



router.get('/product',isAuthenticated, userController.getUserProducts)

router.get("/product/details/:id" , userController.getProductDetails)

router.post("/product/details/:id" ,userController.postProductDetails)


router.get('/product/:id', userController.productQuantity)


router.get('/auth/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/login' }),
    (req, res) => {
        res.render('home/index');
    }
);



router.get('/categories', userController.getUserCategories)

router.get('/profile', profileController.getProfile);

router.get('/address', profileController.getAddress)

router.post('/save-address', profileController.postSaveAddress)

router.get('/display-address', profileController.getDisplayAddress)

router.get('/edit-address/:id' , profileController.getEditAddress)

router.post('/edit-address/:id' , profileController.postEditAddress)

router.post('/delete-address/:id', profileController. postDeleteAddress)

router.get('/add-address', profileController.getAddAddress)

router.post('/add-address', profileController.postAddAddress)

router.get('/cart',isAuthenticated, cartController.getCart)


router.post('/add-to-cart',isAuthenticated ,cartController.addToCart)


router.delete('/cart-remove/:id', isAuthenticated,cartController.removeCart)

router.get('/checkout', cartController.checkoutPage)

router.get('/success', cartController.OrderSuccess)
router.get('/loadSuccess',cartController.OrderSuccess)

router.post('/cart-delete', cartController.deleteCart)


router.get('/order',orderController.orderStatus)

router.post('/create-order',orderController.createOrder)


router.get('/order-tracking',orderController.getOrderTrack)




router.post('/cancel-order',orderController.cancelOrder)

router.post('/verify-payment',orderController.verifyPayment)


router.post('/wishlist/add', wishlistController.wishlistAdd)

router.delete('/wishlist/remove/:id', wishlistController.wishlistRemove)

router.get('/wishlist',wishlistController.wishlist)



router.post('/apply-coupon', couponController.applyCoupon)


router.post('/remove-coupon',couponController.removeCoupon)

router.get('/wallet',walletController.getWallet)


router.post('/forgot-password',userController.forgotPassword)

router.get('/forgot-password',userController.getforgotPassword)

router.post('/reset-password', userController.resetPassword)

router.get('/reset-password', userController.getresetPassword)


router.post('/otp-verify',userController.otpVerify)

router.get('/otp-verify',userController.getOtpVerify)


router.post('/submit-return',orderController.submitReturn)


router.get('/download-invoice/:orderId', orderController.getInvoice)

router.get('/order-details/:orderId',orderController.orderDetails)


router.post('/payment/failure',orderController.handlePaymentFailure)

router.post('/checkout/retry',orderController.retryPayment)

router.post('/update-status',orderController.retryStatus);

router.post('/confirm-checkout',cartController.confirmCheckout);


router.post('/submit-rating',userController.submitRating)

router.get('/password',isAuthenticated,profileController.getPassword)

router.post('/password', walletController.changePassword)

module.exports = router;       







