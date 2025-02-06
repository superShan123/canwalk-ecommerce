const mongoose = require('mongoose')


const userWishlist = new mongoose.Schema({
    userId:{type:mongoose.Schema.Types.ObjectId,
        ref:'User'
    },
    productId:[{type: mongoose.Schema.Types.ObjectId,
        ref:'Product'
    }]
    
});



const Wishlist = new mongoose.model('Wishlist',userWishlist)

module.exports = Wishlist;

