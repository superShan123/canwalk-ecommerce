const Product = require('../../models/admin/product');
const Category = require('../../models/admin/category')
const path = require('path');
const mongoose = require('mongoose')
const multer = require('multer');
const fs = require('fs');

// Ensure upload directory exists
const uploadDir = 'public/uploads/products';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (extname && mimetype) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'));
        }
    }
});


// Get all products
const getAdminProduct = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limut) || 5;

        const skip = (page-1)*limit;

        const products = await Product.find({}).skip(skip).limit(limit);

        const totalProducts = await Product.countDocuments();
        const totalPages = Math.ceil(totalProducts/ limit);

        res.render('admin/product', { products,
            currentPage: page,
            totalPages,
            totalProducts,
            limit
         });
    } catch (err) {
        console.error('Error fetching products:', err);
        res.status(500).render('error', { message: 'Error fetching products' });
    }
};

// Render add product form
const getAddProduct = async (req, res) => {
    const categories = await Category.find()
    res.render('admin/productadd', { error: null,categories });
};

// Handle product addition
const postAddProduct = async (req, res) => {
   
    upload.array('images')(req, res, async (err) => {
        if (err) {
            console.error('Upload error:', err);
            return res.status(400).json({ error: err.message});
        }

        try {
            if (!req.files || req.files.length === 0) {
                return res.status(400).json({ error: 'Please upload at least one image' });
            }
            console.log(req.body)
            const { name,quantity, price,color,size,category, highlights,discount} = req.body;

            if (!name || !price) {
                return res.status(400).json({ error: 'Name and price are required' });
            }


            let sizes = Array.isArray(size) ? size : [size]; // Make sure size is an array
            sizes = sizes.map(s => s.trim());

            const categoryId = new mongoose.Types.ObjectId(category)

            const imageUrls = req.files.map(file => `/uploads/products/${file.filename}`);

            const product = new Product({
                name,
                quantity,
                price,
                images: imageUrls,
                color,
                size: sizes,
                category: categoryId,
                highlights,
                discount 
            });

            await product.save();
            res.redirect('/admin/product');
        } catch (err) {
            console.error('Error saving product:', err);
            res.status(500).json({ error: 'Error saving product' });
        }
    });
};

// Get edit product page
const getEditProduct = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id).populate('category')
        if (!product) {
            return res.status(404).render('error', { message: 'Product not found' });
        }
        const categories = await Category.find()
        
        res.render('admin/editproduct', { product, categories });
    } catch (err) {
        console.error('Error fetching product:', err);
        res.status(500).render('error', { message: 'Error fetching product' });
    }
};



const postEditProduct = (req, res) => {
    upload.array('images')(req, res, async (err) => {
        if (err) {
            return res.status(400).json({ error: 'File upload error' });
        }

        try {
            const { name, price, category, quantity, color, discount, size, highlights } = req.body;
            const productId = req.params.id;

            if (!name || !price || !category || !quantity || !discount) {
                return res.status(400).json({ error: 'Name, price, category, quantity, and discount are required' });
            }

            const product = await Product.findById(productId);
            if (!product) {
                return res.status(404).json({ error: 'Product not found' });
            }

            // Validate and assign category
            const categoryExists = await Category.findById(category);
            if (!categoryExists) {
                return res.status(400).json({ error: 'Invalid category' });
            }
            product.category = categoryExists._id; // Ensure the category ID is valid

            // Update basic product details
            product.name = name;
            product.price = price;
            product.quantity = quantity;
            product.color = color;
            product.highlights = highlights;
            product.discount = discount;

            // Handle sizes: parse the sizes from the request
            let parsedSizes = Array.isArray(size)
                ? size.map(s => Number(s))
                : size.split(',').map(s => Number(s.trim()));

            // Validate size input
            if (parsedSizes.some(isNaN)) {
                return res.status(400).json({ error: 'Invalid size format. Sizes must be numbers.' });
            }
            product.size = parsedSizes;

            // Handle image upload: update images if new ones are uploaded
            if (req.files && req.files.length > 0) {
                const imageUrls = req.files.map(file => `/uploads/products/${file.filename}`);
                product.images = imageUrls;
            }

            // Save the updated product
            await product.save();

            // Redirect after successful update
            res.redirect('/admin/product'); // Or wherever you need to redirect
        } catch (error) {
            console.error('Error updating product:', error);
            res.status(500).json({ error: 'Error updating product' });
        }
    });
};




// Block product by setting status to 'inactive'
const productblock = async (req, res) => {
    try {
        const productId = req.params.id;
        const result = await Product.findByIdAndUpdate(productId, { status: 'inactive' }, { new: true });

      

        if (result) {
            console.log("Product status updated to inactive:", result);
        } else {
            console.log("Product not found or update failed");
        }

        const products = await Product.find();
        res.render('admin/product', { products });
    } catch (error) {
        console.error("Error blocking product:", error);
        res.status(500).send("Server error");
    }
};

// Unblock product by setting status to 'active'
const productUnblock = async (req, res) => {
    try {
        const productId = req.params.id;
        const result = await Product.findByIdAndUpdate(productId, { status: 'active' }, { new: true });

        if (result) {
            console.log("Product status updated to active:", result);
        } else {
            console.log("Product not found or update failed");
        }

        const products = await Product.find();
        res.render('admin/product', { products });
    } catch (error) {
        console.error("Error unblocking product:", error);
        res.status(500).send("Server error");
    }
};

// Toggle product status between 'active' and 'inactive'
const toggleProductStatus = async (req, res) => {
    try {
        const productId = req.params.productId;
        const product = await Product.findById(productId);

        if (!product) {
            return res.status(404).send("Product not found");
        }

        const newStatus = product.status === 'active' ? 'inactive' : 'active';
        await Product.findByIdAndUpdate(productId, { status: newStatus });

        res.redirect('/admin/product');
    } catch (error) {
        console.error('Error updating product status:', error);
        res.status(500).send('Internal Server Error');
    }
};


const getLogoutProduct = async (req,res)=>{
    res.render('admin/login')
}


module.exports = {
    getAdminProduct,
    getAddProduct,
    postAddProduct,
    getEditProduct,
    postEditProduct,
    productblock,
    productUnblock,
    toggleProductStatus,
    getLogoutProduct
};

