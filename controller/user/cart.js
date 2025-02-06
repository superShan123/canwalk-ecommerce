const Cart = require("../../models/user/cart");
const userDB = require("../../models/user/user");
const Product = require("../../models/admin/product");
const AddressDB = require("../../models/user/address");
const Order = require('../../models/user/order');
const Coupon = require('../../models/user/coupon')
const { productQuantity } = require("./homeController");



const MAX_PURCHASE_LIMIT = 5;

const getCart = async (req, res) => {
  try {
   const userCart = await Cart.findOne({ userId: req.session.userId })
      .populate({
        path: "items.productId", // Populate product details
        populate: { path: "category", select: "name status" }, // Populate category details
      });

      if (userCart) {
        // Filter out items where the product or category is inactive
        userCart.items = userCart.items.filter(
          (item) =>
            item.productId && 
            item.productId.status === "active" && // Check if product is active
            item.productId.category && 
            item.productId.category.status === "active" // Check if category is active
        );
      }
  
    res.render("home/cart", { userCart });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
};


const addToCart = async (req, res) => {
  try {
   
    const { productId, quantity } = req.body;

    if (!productId) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid product Id" });
    }


    const product = await Product.findById(productId);
    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    // Check if the user is logged in (assuming you have a session or user ID in the request)
    const userId = req.session.userId;

    if(!userId){
      return res.status(401).json({success:true,message:'User not logged in'})
    }


    if(quantity>product.quantity){
      return res.status(400).json({success:false,messsage:`Only ${product.quantity} items are available in stock.`})
    }


    if (quantity > MAX_PURCHASE_LIMIT) {
      return res.status(400).json({
        success: false,
        message: `You can only purchase up to ${MAX_PURCHASE_LIMIT} items at a time.`,
      });
    }


    // Find the cart for the user
    let cart = await Cart.findOne({ userId });

    if (!cart) {
      // If cart doesn't exist, create a new one
      cart = new Cart({ userId, items: [] });
    }

    // Check if product is already in cart
    const existingItem = cart.items.find(
      (item) => item.productId.toString() === productId
    );


    const currentQuantity = existingItem ? existingItem.quantity : 0;

    // Validate stock
    if (currentQuantity + quantity > product.quantity) {
      return res.status(400).json({
        success: false,
        message: `Only ${product.quantity - currentQuantity} items are left in stock.`,
      });
    }

    

    if (existingItem) {
      existingItem.quantity += quantity || 1; // Ensure at least 1 is added
    } else {
      cart.items.push({
        productId,
        quantity: quantity || 1, // Default to 1
        discount: product.discount || 0,
        price: product.price,
      });
    }
    
   // Save the updated cart
    await cart.save();

    

    const userCart = await Cart.findById(cart._id).populate({
      path: "items.productId", // Assuming "items.productId" is the reference to the Product model
      select: "name images _id price", // Only select the required fields
    });

   

    // return res.json({ success: true, message: "Product added to cart", cart: populatedCart });

    res.json({ success: true, message: 'Product added to cart!', cart:userCart });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

const removeCart = async (req, res) => {
  try {
    const productId = req.params.id;
    const user = req.session.userId;

    // Find the user's cart
    const cart = await Cart.findOne({ userId: user });

    if (cart) {
      // Remove the product from the cart
      cart.items = cart.items.filter(
        (item) => item.productId._id.toString() !== productId
      );

      // Save the updated cart
      await cart.save();

      // Return the updated cart data
      res.json({ success: true, message: "Product removed", cart: cart });
    } else {
      res.json({ success: false, message: "Cart not found" });
    }
  } catch (err) {
    console.error("Error removing product from cart:", err.message);
    res.status(500).send("Internal Server Error");
  }
};

const checkoutPage = async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.redirect('/login');
    }

    const userId = req.session.userId;

    // Fetch addresses
    const addresses = await AddressDB.find({ userId });

    if (!addresses || addresses.length === 0) {
      return res.redirect('/address');
    }

// Fetch cart data with populated product details
    const userCart = await Cart.findOne({ userId }).populate({
      path: 'items.productId',
      select: 'name images price discount description' 
    });


    const previousOrders = await Order.findOne({userId})
 

    // Calculate order summary
    let orderSummary = {
      subtotal: 0,
      shipping: 40, // You can adjust shipping cost as needed
      tax: 0,
      total: 0
    };


    if (userCart && userCart.items && userCart.items.length > 0) {
      // Calculate subtotal including discounts
      orderSummary.subtotal = userCart.items.reduce((sum, item) => {
        const priceAfterDiscount = item.productId.discount
          ? item.productId.price - (item.productId.price * item.productId.discount / 100)
          : item.productId.price;
        return sum + (priceAfterDiscount * item.quantity);
      }, 0);

      
      orderSummary.tax = orderSummary.subtotal * 0.10;

     
      orderSummary.total = orderSummary.subtotal + orderSummary.shipping + orderSummary.tax;

      // You can include any discounts applied in `orderSummary.discount` if needed
    }


    const coupons = await Coupon.find().select('code');
 

    // Render checkout page with all data
    res.render('home/checkout', {
      addresses,
      userCart: userCart || { items: [] }, // Provide empty cart if null
      orderSummary,
      previousOrders,  
      coupons  
    });

  } catch (err) {
    console.error('Error in checkout page:', err);
    res.status(500).send('Server Error');
  }
}; 



const OrderSuccess  = async (req,res)=>{
  
  res.render('home/success')
}


const deleteCart = async (req, res) => {
  try {
      const userId = req.session.userId;
      const userCart = await Cart.findOne({ user: userId });

      if (!userCart) {
          return res.redirect('/cart?error=Cart not found');
      }

      // Remove items from the cart
      userCart.items = [];
      await userCart.save();

      // Redirect to success page after deletion
      res.redirect('/success');
  } catch (error) {
      console.error('Error deleting cart:', error);
      res.redirect('/cart?error=Failed to delete cart');
  }
};


const confirmCheckout = async (req, res) => {
  try {
    const { addressId } = req.body; // Extract the selected address ID from the request body

    // Validate if the user is logged in
    if (!req.session.userId) {
      return res.status(401).json({ success: false, message: 'User not logged in.' });
    }

    // Find the selected address
    const selectedAddress = await AddressDB.findOne({
      _id: addressId,
      userId: req.session.userId,
    });

    // Check if the address exists and belongs to the user
    if (!selectedAddress) {
      return res.status(404).json({ success: false, message: 'Address not found.' });
    }

    // Save the selected address in the session for checkout processing
    req.session.selectedAddress = selectedAddress;

    // Respond with success
    res.json({ success: true, message: 'Address selected successfully.', address: selectedAddress });
  } catch (err) {
    console.error('Error confirming checkout:', err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};


module.exports = {
  getCart,
  addToCart,
  removeCart,
  checkoutPage,
  OrderSuccess,
  deleteCart ,
  confirmCheckout 

};


