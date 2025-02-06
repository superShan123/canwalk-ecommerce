const Wishlist = require('../../models/user/wishlist');
const Product = require('../../models/admin/product')





const wishlistAdd = async (req,res)=>{
     const {productId} = req.body;
     const userId = req.session.userId;

try{
        await Wishlist.updateOne(
            { userId: userId},
            {$addToSet:{productId:productId}},
            {upsert: true}  
        );
        res.json({success:true, message:'Added to wishlist'})

     }catch(error){
        console.error('Error adding to wishlist', error)
        res.status(500).json({success:false, message:'Failed to add to wishlist'})
    }
}



const wishlistRemove = async (req,res)=>{
    const {id} = req.params
    const userId = req.session.userId;


    console.log('Params:', req.params);
console.log('User ID:', req.session.userId);


    try{
       const result =  await Wishlist.findOneAndUpdate(
            {userId},
            {$pull:{productId: id}},
            {new:true}
        );

        console.log('updated wishlist',result)

        if(result){
            res.status(200).json({success:true,message:'Product removed succesfully'})
        }else{
            res.status(404).json({success:false, message:'Product not found in wishlist'})
        }
        
    }catch(err){
        console.error('Eroor removing from wishlist', err)
        res.status(500).json({success:false, message:'Failed to remove from wishlist'})
    }
}

const wishlist = async (req, res) => {
    const userId = req.session.userId;

    if (!userId) {
        return res.redirect('/login');
    }

try {
        // Find the wishlist for the user and populate productId
        const wishlist = await Wishlist.findOne({ userId: userId }).populate({
            path:'productId',
            match: {status:'active'}
        })

        console.log('Fetched wishlist:', wishlist);  

    
        const products = wishlist && wishlist.productId ? wishlist.productId : [];
        res.render('home/wishlist', { products });

   } catch (err) {
        console.error('Error fetching wishlist:', err);
        res.status(500).send('Failed to load wishlist');
    }
};





module.exports = {
    wishlistAdd,
    wishlistRemove,
    wishlist
}