const mongoose = require('mongoose')

const addressSchema = new mongoose.Schema({
    firstname: { type: String, required: true },
    lastname: { type: String, required: true },
    phone: { type: String, required: true },
    pincode:{type:String ,required:true},
    city:{type:String, required:true},
    state:{type:String , required:true},
    userId:{
        type: mongoose.Schema.Types.ObjectId,
        ref:"User"
    }
})


const Address = mongoose.model('Address', addressSchema);

module.exports = Address 




