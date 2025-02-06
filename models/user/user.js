const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: { type: String, required:true},
    email: { type: String, unique:true,required:true },
    password: { 
        type: String, 
        required: function () {
            // Make password required only if googleId is not present
            return !this.googleId;
        },
    },
    googleId: { type:String, unique:true,sparse:true},
    status: {
        type: String,
        enum: ['active', 'inactive'],  // Use lowercase as defined here
        default: 'active',
    },
    isBlocked: {
        type: Boolean,
        default: false
    },
   

    
});

// Ensure the model name corresponds to your use case. Change 'User' to 'Customer' if needed.
const User = mongoose.model('User', userSchema);

module.exports = User;
