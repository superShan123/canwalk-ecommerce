const mongoose = require('mongoose')


const couponSchema = new mongoose.Schema({
    code:{
        type:String,
        required:true,
        unique:true,
        uppercase:true,
    },

    discountType:{
        type:String,
        enum:['percentage','flat'],
        required:true,
    },
    discount:{
        type:Number,
        required:true  
    },
    minAmount:{
        type:Number,
        required:true 
    },
    maxAmount:{
        type:Number,
        required:true 
    },
    userLimit:{
        type:Number,
        required:true,
    },

    expiryDate:{
        type:Date,
        required:true
    },

    description:{
        type:String,

    },

    redeemedBy: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    
},{timestamps:true})


const Coupon = new mongoose.model('Coupon',couponSchema)

module.exports = Coupon;







