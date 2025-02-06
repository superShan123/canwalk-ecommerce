const express = require('express');
const router = express.Router();
const adminController = require('../controller/admin/adminController'); // Make sure the path is correct
const categoryController = require('../controller/admin/categoryController')
const { isAuthenticated, isAdminAuthenticated } = require("../middleware/authMiddleware")
const productController = require('../controller/admin/productController')
const orderController = require('../controller/user/order')
const couponController = require('../controller/admin/coupon')
const salesController = require('../controller/admin/sales')
const offerController = require('../controller/admin/offer')

// Admin login routes
router.get('/login',adminController.getAdminLogin);
router.post('/login', adminController.postAdminLogin);

// Admin dashboard and logout
router.get('/dashboard', adminController.getAdminDashboard);
router.get('/logout', adminController.adminLogout);

// Customers
router.get('/customers',isAdminAuthenticated, adminController.getAdminCustomer);

// Categories routes
router.get('/categories',isAdminAuthenticated, categoryController.getAdminCategory);
router.get('/categories/add', categoryController.getAddCategory);
router.post('/categories/add', categoryController.postAddCategory);
router.get('/categories/edit/:id', categoryController.getEditCategory);
router.post('/categories/edit/:id', categoryController.postEditCategory);

// Block category route
router.post('/categories/toggle/:userId', categoryController.blockCategory);

// Toggle user status
router.post('/toggle-status/:userId', adminController.toggleUserStatus);

router.post('/toggle-status-category/:categoryId',categoryController.toggleCategoryStatus)

router.get('/product',isAdminAuthenticated, productController.getAdminProduct)

router.get('/product/add', productController.getAddProduct)

router.post('/product/add' ,productController.postAddProduct)

router.get('/product/edit/:id', productController.getEditProduct)

router.post('/product/edit/:id', productController.postEditProduct)

router.post('/product/toggle-status/:productId', productController.toggleProductStatus);



router.get('/logout',isAdminAuthenticated, productController.getLogoutProduct)

router.get('/order',isAdminAuthenticated,orderController.getAllOrders)

router.post('/update-status',orderController.updateStatus)



router.get('/order/:orderId', orderController.viewDetails)


router.get('/coupon',isAdminAuthenticated,couponController.getCoupon)

router.get('/coupon-add',couponController.getaddCoupon)

router.post('/coupon-add',couponController.addCoupon)

router.post('/coupon-delete',couponController.deleteCoupon)

router.get('/sales-report',isAdminAuthenticated,salesController.salesReport)

router.get('/download-report',salesController.downloadSalesReport)



router.post('/add-offer',offerController.createOffer)  

router.get('/add-offer',offerController.getCreateOffer)

router.get('/offer',isAdminAuthenticated,offerController.getOffer)


router.post('/delete-offer/:id', offerController.deleteOffer)

router.get('/update-offer/:id', offerController.getupdateOffer)

router.post('/update-offer/:id', offerController.postupdateOffer)


module.exports = router;




