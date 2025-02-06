const userDB = require("../../models/user/user");
const AddressDB = require("../../models/user/address");
const Wallet = require('../../models/user/wallet')
const bcrypt = require('bcrypt')

const getProfile = async (req,res)=>{
  try{
    const userId = req.session.userId
    if(!userId){
     return  res.redirect('/login')
    }
    const user = await userDB.findById(userId)
    if(!user){
      return res.status(404).send('User not found')
    }

    const wallet = await Wallet.findOne({userId})

   const walletBalance = wallet ? wallet.balance:0;
    
    const {username, email} = user;

    res.render('home/profile',{username,email,walletBalance})
  } catch(err){
    console.error('Error while fetching the profile', err)
    res.status(500).send('Server Error')
  }
}


const getAddress = async (req,res)=>{
  try{
    if(!req.session.userId){
      return res.redirect('/login')
    }
    const userId = req.session.userId;
    const existingAddress = await AddressDB.findOne({userId});

    if(existingAddress){
      return res.redirect('/display-address')
    }else{
      return res.render('home/address')
    }
  }catch(err){
    console.error('Error checking for existing address', err)
    res.status(500).send('Server Error')
  }
}

const postSaveAddress = async (req, res) => {
  try {
    const { firstname, lastname, phone, pincode, city, state } = req.body;

    // Ensure userId exists in the session
    if (!req.session.userId) {
      return res.status(401).send('Unauthorized: User not logged in');
    }

    const userId = req.session.userId;

    // Create the address object with the userId
    const address = new AddressDB({
      firstname,
      lastname,
      phone,
      pincode,
      city,
      state,
      userId,  // Include the userId for association
    });

    await address.save();
    res.redirect('/display-address')

  } catch (err) {
    console.error('Error saving address:', err);
    res.status(500).send('Error saving address');
  }
};


const getDisplayAddress = async (req, res) => {
  try {
      // Ensure the user is authenticated
      if (!req.session.userId) {
          return res.redirect('/login');
      }

      const userId = req.session.userId;
      console.log('user id is', userId)

      // Fetch addresses associated with the user
      const addresses = await AddressDB.find({ userId });
      console.log('addresesses', addresses);

      if(!addresses){
        return res.redirect('/address')
      }



      // Render the display address page with the fetched addresses
      res.render('home/display-address', { addresses });
  } catch (err) {
      console.error('Error displaying address:', err);
      res.status(500).send('Server Error');
  }
};



const getEditAddress = async (req,res)=>{
  const addressId = req.params.id;
  console.log(addressId)
  try{
    const address = await AddressDB.findById(addressId);
    res.send('successfull')
  } catch(err){
    console.error(err)
    res.status(500).send('Error fetching address')
  }
}


const postEditAddress = async(req,res)=>{
  const addressId = req.params.id;
  const updateData =  req.body

  try{
    await AddressDB.findByIdAndUpdate(addressId,updateData)
    res.redirect('/display-address')
  }catch(err){
    console.error(error)
    res.status(500).send('Error updaing address')
  }
}

const postDeleteAddress = async(req,res)=>{
  const addressId = req.params.id;
  try{
    await AddressDB.findByIdAndDelete(addressId)
    res.redirect('/display-address')
  }catch(err){
    console.error(error)
    res.status(500).send('Error deleting address')
  }
}

const getAddAddress = async (req,res)=>{
res.render('home/add-address')
}


const postAddAddress = async(req,res)=>{
  try{
    const {firstname,lastname,phone,state,pincode,city} =  req.body

    if(!req.session.userId){
      return res.redirect('/login')
    }

    const userId = req.session.userId

    const address = new AddressDB({
      firstname,
      lastname,
      pincode,
      city,
      state,
      phone,
      userId
    });
    await address.save()
    console.log(' add address',address)

    res.redirect('/display-address')
  }catch(err){
    console.error('Error fetching the add address', err)
    res.status(500).send('Server Error')
  }
}


const getPassword = async (req,res)=>{
  try{
    res.render('home/res-password')
  }catch(err){
    console.error(err)
    res.status(500).send('Error')
  }
  
}







module.exports = {
    getProfile,
    getAddress,
    postSaveAddress,
    getDisplayAddress,
    getEditAddress,
    postEditAddress,
    postDeleteAddress,
    getAddAddress,
    postAddAddress,
    getPassword
  
};
   

