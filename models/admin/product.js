const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    name: { type: String, required: true },  
    price: { type: Number, required: true }, 
    discount: { type: Number, default: 0 }, 
    images: [{ type: String, required:true}],
    quantity:{type:Number , required:true, default:0},          
    
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref:'Category'
    }, 
           
    status: {
        type: String,
        enum: ['active', 'inactive'],       
        default: 'active',
    },              
    highlights:{type:String}, 
   
    averageRating: {type:Number, default:0} ,  
    totalRatings: { type: Number, default: 0 },           
    size: [Number],                 
    color: { type: String }},
    
    {timestamps:true},
);


const Product = mongoose.model('Product', productSchema);

module.exports = Product;





