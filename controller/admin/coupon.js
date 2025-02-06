const Coupon = require('../../models/user/coupon')
const Cart = require('../../models/user/cart')
const Product = require('../../models/admin/product')



// create a new coupon

const addCoupon = async (req,res)=>{
    try{
        const {code,discountType,discount ,minAmount,maxAmount, userLimit, expiryDate, description} = req.body;

        const newCoupon = new Coupon({
            code,
            discountType,
            discount,
            minAmount,
            maxAmount,
            userLimit,
            expiryDate,
            description
        });

        await newCoupon.save();
        res.redirect('/admin/coupon')
    }catch(err){
        console.error('Error fetching the coupon',err)
        res.status(500).send('Internal server error')
    }

}  

// fetch all coupons

const getCoupon = async (req,res)=>{
try{
  const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 5;
        const skip = (page-1)*limit;

    const coupons = await Coupon.find().skip(skip).limit(limit);

    const totalCoupons = await Coupon.countDocuments() ;
        const totalPages = Math.ceil(totalCoupons/ limit);

    res.render('admin/coupon',{coupons,
      currentPage: page,
      totalPages: totalPages,
      totalCoupons: totalCoupons,
      limit: limit,
    })
}catch(err){
    console.error('Error fetching the coupon',err)
    res.status(500).send('Internal server error')
}
}





const deleteCoupon = async (req,res)=>{
    try{
        const {couponId} = req.body;
        const deletedCoupon = await Coupon.findByIdAndDelete(couponId);

        if (!deletedCoupon) {
            return res.status(404).send('Coupon not found');
          }

        res.redirect('/admin/coupon')
    }catch(err){
        console.error('Error fetching the coupon',err)
        res.status(500).send('Error deleting coupons')
    }
}



const getaddCoupon = async (req,res)=>{
    res.render('admin/addcoupon')
}



const applyCoupon = async (req, res) => {
    try {
      const { code } = req.body;
      const userId = req.session.userId;

      console.log('recived coupon is ', code)
  
      // Validate user ID session
      if (!userId) {
        return res.status(400).send({ message: 'User not logged in' });
      }
  
      // Find the user's cart
      const userCart = await Cart.findOne({ userId });
  
      if (!userCart || userCart.items.length === 0) {
        return res.status(400).send({ message: 'Your cart is empty. Please add items to the cart before applying the coupon.' });
      }
  
      console.log('Cart details:', userCart);
  
      // Fetch product details for all items in the cart
      const productIds = userCart.items.map(item => item.productId);
      const products = await Product.find({ _id: { $in: productIds } });
  
      // Calculate subtotal
      const subtotal = userCart.items.reduce((sum, item) => {
        const product = products.find(p => p._id.toString() === item.productId.toString());
        if (!product) {
          console.log(`Product with ID ${item.productId} not found`);
          return sum; // Skip missing products
        }
  
        // Apply product discount
        const priceAfterDiscount = product.discount
          ? product.price - (product.price * product.discount / 100)
          : product.price;
        return sum + item.quantity * priceAfterDiscount;
      }, 0);
  
      console.log('Subtotal is:', subtotal);
  
      // Find and validate the coupon
      const coupon = await Coupon.findOne({ code });

      console.log('kitti', coupon) 

     
  
      if (!coupon) {
        console.log('coupon not found')
        return res.status(400).send({ message: 'Invalid coupon code' });
      }


      console.log('Fetched coupon', coupon)
      
      
      // Check if the coupon has expired
      if (coupon.expiryDate < new Date()) {
          return res.status(400).send({ message: 'Coupon has expired' });
        }

       

      // Check if the coupon has already been redeemed by the user
      if (coupon.redeemedBy.includes(userId)) {
        return res.status(400).send({ message: 'You have already redeemed this coupon' });
      }

    
  
      // Check if the subtotal meets the minimum amount for the coupon
      if (subtotal < coupon.minAmount) {
        console.log(`Subtotal (${subtotal}) is less than the minumum required (${coupon.minAmount})`)
        return res.status(400).send({ message: `Minimum spend for this coupon is ₹${coupon.minAmount}` });
      }
      

      
      // Calculate the discount based on the coupon type
      let discount = 0;
      if (coupon.discountType === 'percentage') {
        discount = (subtotal * coupon.discount) / 100;
        discount = Math.min(discount, coupon.maxAmount);
      } else if (coupon.discountType === 'flat') {
        discount = Math.min(coupon.discount, coupon.maxAmount);
      }
  
      
  
      const shippingCharges = 40; 
      const tax = subtotal * 0.1;
      console.log('Discount amount:', discount, subtotal, shippingCharges, tax);
      req.session.orderSummary = {
        subtotal,
        shippingCharges,
        tax,
        discount,
        total: subtotal + shippingCharges + tax - discount,
      };
  
      const orderSummary = req.session.orderSummary;
  
      console.log('Order Summary:', orderSummary);
  
      // Add the user ID to the redeemedBy array to prevent reuse of the coupon
      coupon.redeemedBy.push(userId);
      await coupon.save(); // Ensure the coupon is saved after updating the redeemedBy array
  
      res.json({
        success: true,
        orderSummary,
        message: `Coupon applied successfully. You saved ₹${discount}!`,
    });
  
    } catch (err) {
      console.error('Error applying coupon:', err);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  };
  

  const removeCoupon = async (req, res) => {
    try {
      const userId = req.session.userId;
  
      // Validate user ID session
      if (!userId) {
        return res.status(400).send({ message: 'User not logged in' });
      }
  
      // Check if a coupon was applied
      if (!req.session.orderSummary || !req.session.orderSummary.discount) {
        return res.status(400).send({ message: 'No coupon applied to remove' });
      }

      console.log('order summary before removal',req.session.orderSummary)
  
      // Remove the coupon-related fields from the session
      const { subtotal, shippingCharges, tax } = req.session.orderSummary;
  
      req.session.orderSummary = {
        subtotal,
        shippingCharges,
        tax, // Reset discount
        total: subtotal + shippingCharges + tax, // Recalculate total without discount
      };

      console.log('Order Summary After Removal:', req.session.orderSummary);
  

      // Find the coupon and remove the user from `redeemedBy`
      const coupon = await Coupon.findOne({ redeemedBy: userId });
      if (coupon) {
        console.log('coupon Found', coupon)
        coupon.redeemedBy = coupon.redeemedBy.filter((id) => id.toString() !== userId.toString());
        await coupon.save();
      }
  
      res.json({
        success: true,
        orderSummary: req.session.orderSummary,
        message: 'Coupon removed successfully',
      });

      console.log('Response sent to frontend successfully');
    } catch (err) {
      console.error('Error removing coupon:', err);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  };
  



module.exports = {
    addCoupon,
    getCoupon,
    deleteCoupon,
    getaddCoupon,
    applyCoupon,
    removeCoupon
}


