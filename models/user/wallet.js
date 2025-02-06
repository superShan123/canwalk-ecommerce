const mongoose = require('mongoose')


const walletSchema = new mongoose.Schema({
    userId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'User'
    },
    balance:{type:Number, default:0},
    transactions:[ 
        {
            orderId:{
                type:String
            },
            amount:{
                type:Number
            },
            method:{
                type:String
            },
            type:{
                type:String,
                enum:['credit','debit'],
                required:true
            },
            createdAt:{
                type:Date,
                default: Date.now 
            }

        }
    ]

},{timestamps:true})


const Wallet = new mongoose.model('Wallet',walletSchema);

module.exports = Wallet;


