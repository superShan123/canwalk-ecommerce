const Category = require('../../models/admin/category');
// const User = require("../../models/user/user");
const mongoose = require('mongoose')

// Get Admin Categories (With Edit functionality)
const getAdminCategory = async (req, res) => {
    try {

        const page = parseInt(req.query.page) || 1;

        const limit = parseInt (req.query.limit) || 4;

        const skip = (page-1)*limit;
        
        const categories = await Category.find().skip(skip).limit(limit)

        const totalCategories = await Category.countDocuments();
        const totalPages = Math.ceil(totalCategories / page);

        const editCategory = null;
        const message = req.query.message || '' 
        const messageType = req.query.messageType || 'success';

        res.render('admin/categories', { categories, editCategory, message, messageType,currentPage:page, totalPages:totalPages,totalCategories: totalCategories,limit:limit  });  // Pass both categories and editCategory to the view
    } catch (err) { 
        console.error("Error fetching categories:", err);
        res.render('admin/categories', {
            categories: [],
            editCategory: null,
            message: 'Error fetching categories.',
            messageType: 'error'  // Set message type to 'error' in case of failure
        });
    }
    }



// Get Add Category Page
const getAddCategory = (req, res) => {
    res.render('admin/addCategory');
};

// Add New Category (POST)
const postAddCategory = async (req, res) => {
    try {
        const categoryName = req.body.categoryName;

        const existingCategory = await Category.findOne({name: categoryName})

        if(existingCategory){
            const categories = await Category.find()
            return res.render('admin/categories', { 
                message: 'Category already exists',
                messageType :'error',
                categories 

             });

        }
        
        const newCategory = new Category({name: categoryName,});
        await newCategory.save();
        res.redirect('/admin/categories?message=Category added successfully');
    } catch (err) {
        console.error("Error adding category:", err);
        res.status(500).send('Error adding category.');
    }
};

// Get Edit Category Page
const getEditCategory = async (req, res) => {
    try {
        const categoryId = req.params.id;
        const category = await Category.findById(categoryId);

        if (!category) {
            return res.status(404).send('Category not found');
        }

       

        res.render('admin/editcategories', {  category });  // Pass editCategory here
    } catch (err) {
        console.error("Error fetching category for editing:", err);
        res.status(500).send('Error fetching category for editing.');
    }
};





// Edit Category (POST)
const postEditCategory = async (req, res) => {
    try {
        const categoryId = req.params.id;
        const updatedCategoryName = req.body.categoryName;

        await Category.findByIdAndUpdate(categoryId, { name: updatedCategoryName });
        res.redirect('/admin/categories');
    } catch (err) {
        console.error("Error updating category:", err);
        res.status(500).send('Error updating category.');
    }
};

// Block Category

const blockCategory = async (req, res) => {
    try {
        const categoryId = req.params.id;
        
        // Update the category status to 'inactive' (or 'blocked')
        const result = await Category.findByIdAndUpdate(categoryId, { status: 'inactive' }, { new: true });

        if (result) {
            console.log("Category status updated to inactive:", result);
        } else {
            console.log("Category not found or update failed");
        }

        const categories = await Category.find(); // Fetch all categories for the admin view

        res.render('admin/categories', { categories, editCategory: null });
    } catch (error) {
        console.error("Error blocking category:", error);
        res.status(500).send("Server error");
    }
};



const toggleCategoryStatus = async (req,res)=>{
    const categoryId = req.params.categoryId;
    console.log(categoryId)

    const {status} = req.body
    console.log(status)

   
    console.log('Request received:', req.method, req.originalUrl);  // Log method and URL

    try{  
        const category = await Category.findById(categoryId)
        console.log(category)

        if(!category){
            return res.status(404).send({message:'Category not found'})
        }
        
        
        category.status = status;
        await category.save()

        console.log(category.status)

            

         res.redirect('/admin/categories')
        
    } catch(error){
        console.error('Errror updating category ',error)
        res.status(500).send('Internal Server Error')
    }
}



    

module.exports = {
    getAdminCategory,
    getAddCategory,
    postAddCategory,
    getEditCategory,
    postEditCategory,
    blockCategory,
    toggleCategoryStatus
};


