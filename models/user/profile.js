const mongoose = require('mongoose')

const profileSchema = new mongoose.Schema({
    username:{type:String,required:true},
    email:{type:String, required:true, unique:true},
    userId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'User'
    }
})


const Profile = new mongoose.model('profile', profileSchema)

module.exports = Profile 

