const Order = require('../../models/user/order')
const Cart = require('../../models/user/cart')
const AddressDB = require('../../models/user/address')
const Razorpay = require('razorpay')
const crypto = require('crypto')
const userDB = require('../../models/user/user')
const Coupon = require('../../models/user/coupon')
const Product = require('../../models/admin/product')
const Wallet  = require('../../models/user/wallet')
const {v4: uuidv4} = require('uuid')
const { path } = require('path')
const { fs } = require('fs')
const doc = require('pdfkit');
const PDFDocument = require('pdfkit')



const razorpayInstance =  new Razorpay({
  key_id :   "rzp_test_KDYrLJHnu3O9Ip" ,
  key_secret : "bcOjtnHN19lrbqBWdS35Ee7J",
})



const createOrder = async (req, res) => {
  try {
    const { items, address, paymentMethod, shippingCharges, total, code } = req.body;
    const userId = req.session.userId;

    if (!userId) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const userCart = await Cart.findOne({ userId });

    if (!userCart || !userCart.items.length) {
      return res.status(400).json({ success: false, message: `Cart is empty or does not exist` });
    }

    const productIds = userCart.items.map(item => item.productId);
    const products = await Product.find({ _id: { $in: productIds } });

    // Calculate subtotal
    const subtotal = userCart.items.reduce((sum, item) => {
      const product = products.find(p => p._id.toString() === item.productId.toString());
      const priceAfterDiscount = product.discount ? product.price - (product.price * product.discount / 100) : product.price;
      return sum + item.quantity * priceAfterDiscount;
    }, 0);

    const tax = subtotal * 0.1;
    let couponDiscount = 0;

    if (code) {
      const coupon = await Coupon.findOne({ code });
      if (!coupon) {
        return res.status(400).send({ message: 'Invalid coupon code' });
      }
      if (coupon.expiryDate < new Date()) {
        return res.status(400).send({ message: 'Coupon has expired' });
      }

      if (coupon.discountType === 'percentage') {
        couponDiscount = (subtotal * coupon.discount) / 100;
        couponDiscount = Math.min(couponDiscount, coupon.maxAmount);
      } else if (coupon.discountType === 'flat') {
        couponDiscount = Math.min(coupon.discount, coupon.maxAmount);
      }
    }

    let calculatedTotal = subtotal + shippingCharges + tax - couponDiscount;

    if (paymentMethod.method === 'Cash on Delivery' && calculatedTotal > 1000) {
      return res.status(400).json({
        success: false,
        message: 'Orders above ₹1000 are not allowed for Cash on Delivery.',
      });
    }

    const orderId = `ORD-${uuidv4()}`;

    if (paymentMethod.method === 'Wallet') {
      console.log(paymentMethod.method, 'Payment Method');

      const userWallet = await Wallet.findOne({ userId });

      if (!userWallet || userWallet.balance < calculatedTotal) {
        return res.status(400).json({ success: false, message: 'Insufficient wallet balance' });
      }

      userWallet.balance -= calculatedTotal;

      if (!userWallet.transactions) {
        userWallet.transactions = [];
      }

      // Push the transaction entry
      userWallet.transactions.push({
        orderId: orderId.toString(),
        amount: calculatedTotal,
        method: 'Wallet',
        type: 'debit',
        status: 'Paid',  
        transactionDate: new Date()
      });

      // Save updated wallet
      await userWallet.save();
    }

    // Create Razorpay order if payment method is Credit Card
    let razorpayOrderId = null;

    if (paymentMethod.method === 'Credit Card') {
      const razorpayOrder = await razorpayInstance.orders.create({
        amount: Math.round(calculatedTotal * 100), // Amount in paise
        currency: 'INR',
        receipt: `receipt_${new Date().getTime()}`,
      });

      razorpayOrderId = razorpayOrder.id;
    } else if (paymentMethod.method !== 'Wallet' && paymentMethod.method !== 'Cash on Delivery') {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment method. Please choose a valid payment option.',
      });
    }

    // Create the new order
    const newOrder = new Order({
      orderId,
      userId,
      items,
      shippingAddress: {
        FirstName: address.Firstname,
        LastName: address.Lastname,
        city: address.city,
        state: address.state,
        pincode: address.pincode,
        phone: address.phone,
      },
      orderSummary: {
        subtotal,
        shippingCharges,
        tax,
        couponDiscount,
        total: calculatedTotal,
      },
      paymentInfo: {
        method: paymentMethod.method,
        razorpayOrderId,
        status: paymentMethod.method === 'Wallet' ? 'PAID' : 'PENDING',  
        paymentDate: new Date(),
      },
      createdAt: new Date(),
    });

    // Save the order to the database
    const orders = await newOrder.save();

    // Update product quantities
    for (let item of items) {
      const product = await Product.findById(item.productId);
      if (product) {
        if (product.quantity < item.quantity) {
          return res.status(400).json({ success: false, message: `Not enough stock for ${product.name}` });
        }

        // Deduct the quantity from the product stock
        product.quantity -= item.quantity;
        await product.save();
      }
    }

    // Delete the user's cart after the order is placed
    await Cart.deleteMany({ userId });

    // Send response
    res.json({
      success: true,
      message: 'Order placed successfully',
      razorpayOrderId,
      orderSummary: {
        subtotal,
        shippingCharges,
        tax,
        couponDiscount,
        total: calculatedTotal,
      },
      orderId,
      paymentInfo: newOrder.paymentInfo,
    });

  } catch (err) {
    console.error('Error fetching the order', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};






const orderStatus = async (req, res) => {
  try {
    const { orderId } = req.query;
    const userId = req.session.userId;

    if (!userId) {
      return res.redirect('/login');
    }

    if (!orderId) {
      return res.status(404).send('Order ID is missing');
    }

    // Fetch the order details based on userId and orderId
    const order = await Order.findOne({  orderId, userId }).populate('items.productId');
    console.log('order is ',order)

    if (!order) {
      return res.status(404).send('Order not found for this user');
    }

    // Calculate subtotal
    const subtotal = order.items.reduce((sum, item) => {
      const product = item.productId;
      const discount = product.discount || 0;
      const discountedPrice = product.price - (product.price * discount / 100);
      return sum + (item.quantity * discountedPrice);
    }, 0);

    let couponDiscount = 0;
    if (order.couponCode) {
      // Fetch the coupon details from the Coupon collection using the coupon code
      const coupon = await Coupon.findOne({ code: order.couponCode });

      if (coupon) {
        const currentDate = new Date();
        if (currentDate > coupon.expiryDate) {
          return res.status(400).send('Coupon has expired');
        }

        if (coupon.discountType === 'percentage') {
          couponDiscount = (subtotal * coupon.discount) / 100;
        } else if (coupon.discountType === 'flat') {
          couponDiscount = coupon.discount;
        }

        if (couponDiscount > coupon.maxAmount) {
          couponDiscount = coupon.maxAmount;
        }
      } else {
        return res.status(400).send('Coupon not found');
      }
    }

    const shippingCharges = 40; // Default shipping charges, can be dynamic
    const tax = subtotal * 0.1; // Assuming 10% tax
    const discount = order.orderSummary.discount || 0;
    const calculatedtotal = subtotal + tax + shippingCharges - discount - couponDiscount;

    console.log('order status  Subtotal:', subtotal);
    console.log(' order status Shipping Charges:', shippingCharges);
    console.log('Tax:', tax);
    console.log('Discount (from order):', discount);
    console.log('Coupon Discount:', couponDiscount);
    console.log('Total:', calculatedtotal);

    console.log('order senting to frontyend',order)

    res.render('home/orderstatus', {
      order,
      calculatedTotal: calculatedtotal,
    });

  } catch (err) {
    console.error('Error fetching the order:', err);
    res.status(500).send('Internal server error');
  }
};



const getAllOrders = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 7;
    const skip = (page - 1) * limit;

    // Fetch orders with sorting by createdAt descending to get the latest first
    const orders = await Order.find()
      .populate('userId', 'username')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 }); 

    const totalOrders = await Order.countDocuments();
    const totalPages = Math.ceil(totalOrders / limit);

    res.render('admin/order', {
      orders,
      currentPage: page,
      totalPages: totalPages,
      totalOrders: totalOrders,
      limit: limit,
    });
  } catch (err) {
    console.error('Error fetching the order', err);
    res.status(500).send('Internal server error');
  }
};

  

const updateStatus = async (req,res)=>{
  try{
    const {orderId,status} = req.body
     await Order.findByIdAndUpdate(orderId,{orderStatus:status},{new:true})
     res.redirect('/admin/order')
    
  }catch(err){
    console.error('Error fetching the order',err)
    res.status(500).send('Internal server error')
  }
}


const getOrderTrack = async (req, res) => {
  try {
    const page = parseInt(req.query.page)||1;
    const limit = parseInt(req.query.limit) || 7;

    const skip =(page-1)*limit;

    const userId = req.session.userId;
    if (!userId) {
      return res.redirect('/login');
    }

    const orders = await Order.find({ userId })
      .populate({
        path: 'items.productId',
        select: 'name image',
      })
      .skip(skip).limit(limit);

      const totalOrders = await Order.countDocuments();

      const totalPages = Math.ceil(totalOrders/ limit);

      orders.sort((a,b)=> new Date(b.createdAt)- new Date(a.createdAt))

const downloadInvoiceUrl = '/download-invoice';

    res.render('home/order-track', { orders, downloadInvoiceUrl, currentPage: page,
      totalPages: totalPages, totalOrders: totalOrders, limit: limit
     });
  } catch (err) {
    console.error('Error fetching the order:', err);
    res.status(500).send('Internal server error');
  }
};






const getInvoice = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findById(orderId).populate('items.productId', 'name');

    if (!order) {
      return res.status(404).send('Order not found');
    }

    const fs = require('fs');
    const path = require('path');
    const PDFDocument = require('pdfkit');

    const currentDir = __dirname || process.cwd();
    const invoiceDir = path.join(currentDir, '../invoices');

    if (!fs.existsSync(invoiceDir)) {
      fs.mkdirSync(invoiceDir);
    }

    const filePath = path.join(invoiceDir, `invoice-${orderId}.pdf`);
    console.log('File Path:', filePath);

    const doc = new PDFDocument({ margin: 50 });
    const stream = fs.createWriteStream(filePath);

    doc.pipe(stream);

    // Header Section
    doc.fontSize(16).font('Helvetica-Bold').text('Canwalk Internet Private Limited', { align: 'center' });
    doc.fontSize(10).font('Helvetica').text(
      'Ship-from Address: Buildings Alyssa, Begonia & Clover, Embassy Tech Village, Outer Ring Road, Bengaluru, Karnataka - 560103',
      { align: 'center' }
    );
    doc.text('GSTIN: 29AACCF0663K1ZD', { align: 'center' });
    doc.moveDown(2);

    // Invoice Details
    doc.fontSize(12).font('Helvetica-Bold').text('Invoice Details', { underline: true });
    doc.fontSize(10).font('Helvetica').text(`Invoice Number: ${orderId}`);
    doc.text(`Order Date: ${new Date(order.createdAt).toLocaleDateString()}`);
    doc.text(`Invoice Date: ${new Date().toLocaleDateString()}`);
    doc.text(
      `Billing Address: ${order.shippingAddress.FirstName} ${order.shippingAddress.LastName}, ${order.shippingAddress.city}, ${order.shippingAddress.state}, ${order.shippingAddress.pincode}`
    );
    doc.text(`Phone: ${order.shippingAddress.phone}`);
    doc.moveDown(2);

    // Draw Table Header
    doc.fontSize(10).font('Helvetica-Bold');
    const startX = 50; // Left margin
    doc.text('Description', startX, doc.y, { continued: true, width: 200 });
    doc.text('Qty', startX + 200, doc.y, { continued: true, width: 100, align: 'right' });
    doc.text('Grand Total ₹', startX + 300, doc.y, { width: 100, align: 'right' }); // Added Grand Total in header
    doc.moveTo(startX, doc.y).lineTo(startX + 450, doc.y).stroke();
    doc.moveDown();

    // Table Content
    let overallGrandTotal = 0; // Initialize overall grand total

    order.items.forEach((item) => {
      const taxAmount = (item.price * 0.1).toFixed(2); // Assuming 10% tax
      const subtotal = item.price;
      const total = (subtotal + parseFloat(taxAmount)).toFixed(2); // Grand total for each item
      overallGrandTotal += parseFloat(total); // Accumulate grand total

      doc.font('Helvetica').text(`${item.productId.name}`, startX, doc.y, { continued: true, width: 200 });
      doc.text(`${item.quantity}`, startX + 200, doc.y, { continued: true, width: 100, align: 'right' });
      doc.text(`₹${total}`, startX + 300, doc.y, { width: 100, align: 'right' }); // Display Grand Total for each row
      doc.moveDown(1.5); // Increased spacing between rows
    });

    // Add a line below the table
    doc.moveTo(startX, doc.y).lineTo(startX + 450, doc.y).stroke();
    doc.moveDown(2);

    // Display Overall Grand Total
    doc.font('Helvetica-Bold').text(`Overall Grand Total: ₹${overallGrandTotal.toFixed(2)}`, startX + 300, doc.y, {
      width: 150,
      align: 'right',
    });
    doc.moveDown(2);

    // Thank You Message
    doc.font('Helvetica').fontSize(12).text('Thank you for shopping with Canwalk!', { align: 'center' });
    doc.fontSize(10).text('We hope to see you again soon.', { align: 'center' });
    doc.moveDown(2);

    // Footer
    doc.font('Helvetica').fontSize(10).text('Authorized Signatory', { align: 'right', underline: true });

    // Finalize the PDF
    doc.end();

    // Handle download
    stream.on('finish', () => {
      res.download(filePath, `invoice-${orderId}.pdf`, (err) => {
        if (err) {
          console.error('Error sending file:', err);
        }
        fs.unlinkSync(filePath); // Clean up
      });
    });
  } catch (err) {
    console.error('Error generating invoice:', err);
    res.status(500).send('Internal server error');
  }
};






const cancelOrder = async (req, res) => {
  const { orderId, cancelReason } = req.body;
  try {
    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).send('Order not found');
    }

    // Check if order is already delivered or returned
    if (order.orderStatus === 'DELIVERED' || order.orderStatus === 'RETURNED') {
      return res.status(400).send('Cannot cancel a delivered or returned order');
    }

    const refundAmount = order.orderSummary.total;

    // Update order status and refundAmount
    order.orderStatus = 'CANCELLED';
    order.cancelledAt = new Date();  // Save the cancellation date
    order.cancelReason= cancelReason
    order.refundAmount = refundAmount;  // Store the refund amount in the order

    await order.save();


    console.log('User ID from order:', order.userId);

    let wallet = await Wallet.findOne({userId: order.userId})

    console.log('Wallet found:', wallet);

    if(!wallet){
      wallet = new Wallet({userId : order.userId , balance:0})
      await wallet.save()

    }

    wallet.balance+= refundAmount

    // Ensure transactions is initialized as an array
    if (!Array.isArray(wallet.transactions)) {
      wallet.transactions = [];
    }  

    wallet.transactions.push({
      orderId: order.orderId,  
      amount: refundAmount,
      method: 'Wallet',
      type:'credit'              
    })

    await wallet.save();

    res.redirect('/order-tracking');  // Redirect to order tracking after cancellation
  } catch (err) {
    console.error('Error while canceling the order and updating wallet', err);
    res.status(500).send('Internal server error');
  }
};





const verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, order_id } = req.body;

    if (!order_id) {
      return res.status(400).json({
        success: false,
        message: 'Order ID is required',
      });
    }

    const order = await Order.findOne({ orderId: order_id });
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    console.log("Received order:", order); // Debugging log

    // If Razorpay payment details are provided, verify them
    if (razorpay_order_id && razorpay_payment_id && razorpay_signature) {
      console.log("Razorpay payment details found, verifying...");

      // Razorpay payment verification
      const generatedSignature = crypto
        .createHmac('sha256', 'bcOjtnHN19lrbqBWdS35Ee7J') // Use your secret key
        .update(razorpay_order_id + '|' + razorpay_payment_id)
        .digest('hex');

      console.log('Generated Signature:', generatedSignature); // Debugging log
      console.log('Received Signature:', razorpay_signature); // Debugging log

      if (generatedSignature === razorpay_signature) {
        console.log("Razorpay payment verified successfully.");

        // Update the order to PAID status for Razorpay payment
        await Order.updateOne(
          { orderId: order_id },
          {
            $set: {
              'paymentInfo.status': 'PAID',
              'paymentInfo.paymentId': razorpay_payment_id,
              'paymentInfo.paymentDate': new Date(),
            },
          }
        );

        return res.json({ success: true, message: 'Payment verified successfully via Razorpay' });
      } else {
        console.log("Signature mismatch in Razorpay payment verification.");

        // Update the order status to FAILED in case of signature mismatch
        await Order.updateOne(
          { orderId: order_id },
          {
            $set: {
              'paymentInfo.status': 'FAILED',
              'paymentInfo.transactionId': null,
            },
          }
        );

        return res.status(400).json({ success: false, message: 'Payment verification failed' });
      }
    } else {
      // Wallet payment logic
      console.log("Wallet payment detected, verifying wallet balance...");

      const userWallet = await Wallet.findOne({ userId: order.userId });
      if (!userWallet || userWallet.balance < order.orderSummary.total) {
        console.log("Insufficient wallet balance or wallet not found.");
        return res.status(400).json({
          success: false,
          message: 'Insufficient wallet balance or wallet not found',
        });
      }

      // Deduct wallet balance
      userWallet.balance -= order.orderSummary.total;
      await userWallet.save();

      console.log("Wallet balance deducted successfully.");

      // Update the order to PAID status for Wallet payment
      await Order.updateOne(
        { orderId: order_id },
        {
          $set: {
            'paymentInfo.status': 'PAID',
            'paymentInfo.paymentId': 'WALLET',
            'paymentInfo.paymentDate': new Date(),
          },
        }
      );

      return res.json({ success: true, message: 'Payment verified successfully via Wallet' });
    }
  } catch (err) {
    console.error('Error verifying payment:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};


const submitReturn = async (req, res) => {
 console.log('haaaai REACHED SUBMIT RETURN')
  const { orderId, reason, productQuality, serviceRating, additionalFeedback } = req.body;

  

  try {
    // Fetch the order by ID to get the user and order details
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).send('Order not found');
    }

    // Calculate the refund amount (this assumes orderTotal exists in your order schema)
    const refundAmount = order.orderSummary.total; // Adjust based on your schema, maybe per-product price

    // Find the user who placed the order
    const user = await userDB.findById(order.userId);
    if (!user) {
      return res.status(404).send('User not found');
    }

    // Add the refund amount to the user's wallet
    let wallet = await Wallet.findOne({ userId: order.userId });
    if (!wallet) {
      console.log('no wallet found!',order.userId)
      wallet = new Wallet({ userId: order.userId, balance: 0 });
      
    }

    wallet.balance += refundAmount;

    // Ensure transactions is initialized as an array
    if (!Array.isArray(wallet.transactions)) {
      wallet.transactions = [];
    }

    wallet.transactions.push({
      orderId: order.orderId,
      amount: refundAmount,
      method: 'Wallet',
      type: 'credit', // Credit transaction for the returned product refund
      date: new Date(),
     
    });

    await wallet.save();

    // Update the order status to 'RETURN' and save the return details
    order.orderStatus = 'RETURN';
    order.returnDetails = {
      reason,
      productQuality,
      serviceRating,
      additionalFeedback
    };

    await order.save();

    // Redirect to order tracking page
    res.redirect('/order-tracking');
  } catch (err) {
    console.error('Error processing return:', err);
    res.status(500).send('Error processing return request');
  }
};




const viewDetails = async (req,res)=>{
  try{
    const {orderId} = req.params;

    const order = await Order.findById(orderId).populate('userId')

    if(!order){
      return res.status(404).send('Order not found!')
    }


    order.returnDetails = order.returnDetails || {};

res.render('admin/view-order',{order})
  }catch(err){
    console.error('Error fetching the view details',err)
    res.status(500).send('Internal server error')
  }
}


const orderDetails = async (req,res)=>{
try{
  const {orderId} = req.params;
  const order = await Order.findById(orderId).populate('items.productId')

  if(!order){
    return res.status(404).send('Order not found!')
  }

  res.render('home/order-details',{order})
  console.log('order detils succesfully feteched',order)
}catch(err){
  console.error('Error fetching the order detials',err)
  res.status(500).send('Internal server error')
}
}





const handlePaymentFailure = async (req, res) => {
  try {
    console.log(req.body, 'request body');

    const { razorpay_order_id, order_id } = req.body;

    // Validate input
    if (!razorpay_order_id || !order_id) {
      return res.status(400).json({ success: false, message: "Invalid payment data received" });
    }

    // Find the order by orderId
    const order = await Order.findOne({
      orderId: order_id,
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found for the given Order ID",
      });
    }

    if (order.paymentInfo.status === "PAID") {
      return res.status(400).json({
        success: false,
        message: "Payment already completed for this order",
      });
    }

    if (order.paymentInfo.status === "FAILED") {
      return res.status(200).json({
        success: true,
        message: "Order is already marked as failed",
      });
    }

    console.log("Updating order status to Failed");

    // Update order status and payment info, setting transactionId to null or a default value
    order.paymentInfo.status = "FAILED";
    order.paymentInfo.transactionId = null; // If payment fails, we clear the transaction ID
    order.paymentInfo.paymentDate = new Date();
    
    order.orderStatus = "PENDING";

    await order.save();

    console.log("Order updated to Failed");

    return res.status(200).json({
      success: true,
      message: "Order status updated to Failed",
    });
  } catch (err) {
    console.error("Error handling failed payment", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};





const retryPayment = async (req, res) => {
  try {
    console.log("Received request body:", req.body);

    const { orderId } = req.body;

    // Fetch the order from your database
    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    console.log("Order ID:", order._id);
    console.log("Order Total:", order.orderSummary.total);
    console.log("Payment Info Status:", order.paymentInfo.status);

    if (order.paymentInfo.status !== "FAILED") {
      return res.status(400).json({ success: false, message: "Invalid Order" });
    }


    // Create a Razorpay order
    const razorpayOrder = await razorpayInstance.orders.create({
      amount: order.orderSummary.total * 100, // Amount in paise (100 paise = 1 INR)
      currency: "INR",
      receipt: `receipt_${order._id}`, // Add a receipt ID for tracking
    });

    console.log("Razorpay order created:", razorpayOrder);

    // Send Razorpay order details to the frontend
    return res.json({
      success: true,
      order: {
        id: razorpayOrder.id, // Razorpay order ID
      },
      orderSummary: {
        total: order.total, // Order total in INR
      },
    });
  } catch (error) {
    console.error("Error creating Razorpay order:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create Razorpay order",
      error: error,
    });
  }
};



const retryStatus = async (req,res)=>{
  try{
    const {orderId, paymentId} = req.body;

    const order = await Order.findById(orderId);

    if(!order){
      return res.status(400).json({success:false, message:'Order not found!'})
    }

    if(order.paymentInfo.status === 'PAID'){
      return res.status(400).json({sucess: false, message:'Order alreday marked as Fail'})
    }

   method =  order.paymentInfo.method || 'Unknown'
   console.log('method',method)
    

    order.paymentInfo={
      status:'PAID',
      method,
      paymentId: paymentId

    }

    await order.save()
    res.json({ success: true, message: "Order status updated successfully!" });
  }catch(err){
    console.error('Error fetching the status',err)
    res.status(500).send('Internal server error')
  }
}





module.exports = {
  createOrder,
  orderStatus,
  getAllOrders,
  updateStatus,
  getOrderTrack,
  cancelOrder ,
  verifyPayment,
  submitReturn,
  viewDetails,
  getInvoice,
  orderDetails,
  retryPayment,
handlePaymentFailure,
retryStatus
}



