const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/user/user");

const initializePassport = () => {
    passport.use(
        new GoogleStrategy(
            {
                clientID: process.env.GOOGLE_CLIENT_ID,
                clientSecret: process.env.GOOGLE_CLIENT_SECRET,
                callbackURL: "http://localhost:8001/auth/google/callback", // Update this URL
            },
            async (accessToken, refreshToken, profile, done) => {
                try {
                    console.log("Google profile:", profile); // Log entire profile data to check
    
                    const email = profile.emails && profile.emails[0] && profile.emails[0].value;
                    console.log("Email from Google:", email); // Ensure correct email is retrieved
    
                    // Check if email exists in the database
                    let user = await User.findOne({ email });
    
                    if (user) {
                        console.log("User found:", user); // Log existing user to check
                        return done(null, user); // Log in the existing user
                    }
    
                    console.log("No user found with this email, creating a new user...");
                    // If email doesn't exist, create a new user
                    const newUser = await User.create({
                        googleId: profile.id,
                        email,
                        username: profile.displayName, // Optional: Use displayName as username
                    });
    
                    return done(null, newUser);
                } catch (err) {
                    console.error("Error during Google authentication:", err.message || err);
                    return done(err, null);
                }
            }
        )


    );
    

    passport.serializeUser((user, done) => {
        done(null, user.id);
    });

    passport.deserializeUser(async (id, done) => {
        try {
            console.log("Deserializing user with ID:", id);
            const user = await User.findById(id);
            done(null, user);
        } catch (err) {
            console.error("Error during deserialization:", err.message || err);
            done(err, null);
        }
    });
};


module.exports = initializePassport;
