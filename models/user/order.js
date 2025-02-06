const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    orderId: {
        type: String,
        unique: true ,// Ensure the orderId is unique
        
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    items: [{
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            required: true
        },
        name: {
            type: String,
            required: true
        },
        quantity: {
            type: Number,
            required: true,
            min: 1
        },
        price: {
            type: Number,
            required: true
        },
        image: {
            type: String,
            required: false
        }
    }],
    shippingAddress: {
        FirstName: { type: String, required: true },
        LastName: { type: String, required: true },
        city: { type: String, required: true },
        state: { type: String, required: true },
        pincode: { type: String, required: true },
        phone: { type: String, required: true }
    },
    orderStatus: {
        type: String,
        enum: ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED','RETURN'],
        default: 'PENDING'
    },
    returnDetails: {
        reason: { type: String },
        productQuality: { type: String },
        serviceRating: { type: Number },
        additionalFeedback: { type: String },
        orderRating: {type:Number}
    },
    orderSummary: {
        subtotal: { type: Number, required: true },
        shippingCharges: { type: Number, default: 0 },
        tax: { type: Number, default: 0 },
        couponDiscount: { type: Number, default: 0 },
        total: { type: Number, required: true }
    },
    paymentInfo: {
        method: {
            type: String,
            enum: ['Cash on Delivery', 'Credit Card', 'Wallet'],
            
        },
        status: {
            type: String,
            enum: ['PENDING', 'PAID', 'FAILED'],
            default: 'PENDING'
        },
        transactionId: {
            type: String,
            function() {
                return this.paymentInfo.status === 'PAID' || this.paymentInfo.status === 'FAILED';
            }
        },
        paymentDate: { type: Date },
        isCancelled: { type: Boolean, default: false },
        cancelledAt: {
            type: Date,
            required: function() {
                return this.isCancelled === true;
            }
        },
        cancelReason: { type: String },
        refundAmount: { type: Number, default: 0 }
    }
}, { timestamps: true }); // Timestamps will automatically add 'createdAt' and 'updatedAt'

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;
