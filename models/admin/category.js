const mongoose = require('mongoose')


const categorySchema = new mongoose.Schema({
    name:{type:String, required:true},
    status:{type:String,
        enum:['active','inactive'], 
        default:'active'},
        productIds :[{type: mongoose.Types.ObjectId, ref:'product'}]
       
        
})


const Category = mongoose.model('Category',categorySchema)

module.exports = Category;

