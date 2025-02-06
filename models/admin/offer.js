const mongoose = require('mongoose')

const offerSchema = new mongoose.Schema({
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        required: true
    },
    discountType:{
        type:String,
        enum:['percentage','fixed'],
        required:true 
    },
    discountValue:{
        type:String,
        required:true 

    },
    expiryDate:{
        type:Date,
        required:true 
    },
   
})


const Offer = new mongoose.model('Offer',offerSchema);

module.exports = Offer;








