const Offer = require('../../models/admin/offer')
const Product = require('../../models/admin/product')
const Category = require('../../models/admin/category')


const createOffer = async (req,res)=>{
    try{
        const{category,discountType,discountValue,expiryDate}= req.body;
        console.log('reqbody',req.body)

        const newOffer = new Offer({
            category,
            discountType,
            discountValue,
            expiryDate,
        });
    

        newOffer.save()
         console.log('offer',newOffer)

         
        res.redirect('/admin/offer')
    }catch(err){
        console.error('Error fetching the offer',err);
        res.status(500).send('Internal Server Error')
    }

}


const getCreateOffer = async (req,res)=>{
   try{
    const categories = await Category.find()
    res.render('admin/addoffer',{categories})
   }catch(err){
    console.error('Error fetching the offer',err)
    res.status(500).send('Internal server error')
   }
};



const getOffer = async (req,res)=>{
    try{
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 5;
        const skip = (page-1)*limit;

        const offers = await Offer.find().populate('category').skip(skip).limit(limit).sort({ createdAt: -1 });

        const totalOffers = await Offer.countDocuments() ;
        const totalPages = Math.ceil(totalOffers/ limit);

        res.render('admin/offer',{offers,
            currentPage: page,
            totalPages: totalPages,
            totalOffers: totalOffers,
            limit: limit,
        })
        console.log('offers fetched', offers)
    }catch(err){
        console.error('Error fetching the offer')
        res.status(500).send('Internal server error')
    }
}



const deleteOffer = async (req,res)=>{
    try{
        const{id} = req.params;
        await Offer.findByIdAndDelete(id);
        res.redirect('/admin/offer')
    }catch(err){
        console.error('Error fetching the offer',err)
        res.status(500).send('Internal server error')
    }
}


const getupdateOffer = async (req,res)=>{
    try{
        const {id} = req.params;
        const offer = await Offer.findById(id).populate('category');
        console.log('offer',offer)
        const categories = await Category.find();
        res.render('admin/update-offer', {offer, categories})

    }catch(err){
        console.error('Error fetching offer',err)
        res.status(500).send('Internal server error')
    }
}


const postupdateOffer = async (req,res)=>{
    try{
        const {id} = req.params;
        const {category, discountType, discountValue,expiryDate} = req.body;
        await Offer.findByIdAndUpdate(id,{
            category,
            discountType,
            discountValue,
            expiryDate,
        });
        res.redirect('/admin/offer')

    }catch(err){
        console.error('Error updating offer',err);
        res.status(500).send('Internal server error')
    }
}




module.exports = {
    createOffer,
    getCreateOffer,
    getOffer,
    deleteOffer,
    getupdateOffer,
    postupdateOffer
}



