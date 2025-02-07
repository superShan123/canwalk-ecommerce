const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const session = require('express-session')
const bcrypt = require('bcrypt');
const path = require("path")
const multer = require('multer')
const userRoutes = require("./routes/routes")
const adminRoutes = require('./routes/admin')
const upload = multer({ dest: 'uploads/' });
const passport = require('passport')
const initializePassport = require("./middleware/googleauth");


const app = express();
const port = 8001;





mongoose.connect(process.env.MONGO_URI)  
.then(() => {
    console.log('MongoDB connected...');
})
.catch(err => {
    console.error('MongoDB connection error:', err);
});


 
app.use(session({
        secret: "your-secret-key",
        resave: false,
        saveUninitialized: true,
        cookie: { secure: false } // Set to true if using HTTPS
      }));


      

app.use(express.json())
app.use(express.urlencoded({ extended: true }));

app.use(passport.initialize());
app.use(passport.session());


  // Serve static files  

app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views')); 

initializePassport();

app.use("/",userRoutes)
app.use('/admin',adminRoutes);



app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something went wrong!');
});



app.listen(port, () => {
    console.log('Server is running on http://localhost:' + port);
});









