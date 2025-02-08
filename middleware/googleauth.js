const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/user/user");

const initializePassport = () => {
    passport.use(
        new GoogleStrategy(
            {
                clientID: process.env.GOOGLE_CLIENT_ID,
                clientSecret: process.env.GOOGLE_CLIENT_SECRET,
                callbackURL: "https://canwalk.today/auth/google/callback",
                passReqToCallback: true // Pass `req` to the callback
            },
            async (req, accessToken, refreshToken, profile, done) => {
                try {
                    console.log("Google profile:", profile);
    
                    const email = profile.emails && profile.emails[0] && profile.emails[0].value;
                    let user = await User.findOne({ email });

                    if (!user) {
                        console.log("Creating new user...");
                        user = await User.create({
                            googleId: profile.id,
                            email,
                            username: profile.displayName
                        });
                    }

                    // Save user to session manually
                    req.login(user, (err) => {
                        if (err) return done(err);
                        return done(null, user);
                    });

                } catch (err) {
                    console.error("Error during Google authentication:", err);
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
            const user = await User.findById(id);
            done(null, user);
        } catch (err) {
            done(err, null);
        }
    });
};



module.exports = initializePassport;
