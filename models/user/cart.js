const mongoose = require('mongoose');

const cartSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Types.ObjectId,
        ref: 'User',
        required: true
    },
    items: {
        type: [
            {
                productId: { type: mongoose.Types.ObjectId, ref: 'Product', required: true },
                quantity: { type: Number, required: true, default: 1, min: [1, 'Quantity must be at least 1'] },
                discount: { type: Number, default: 0 }

            }
        ],
        default: []
    }
}, { timestamps: true });

// Index for efficient user cart queries
cartSchema.index({ userId: 1 });

const Cart = mongoose.model('Cart', cartSchema);
module.exports = Cart;  
