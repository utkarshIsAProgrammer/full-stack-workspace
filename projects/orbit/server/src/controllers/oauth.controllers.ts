import { Request, Response } from "express";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { randomBytes } from "crypto";
import { User } from "../models/user.model";
import { env } from "../configs/env";
import { cookieOptions } from "../configs/cookie";
import { setCsrfCookie } from "../middlewares/csrf.middleware";
import { logger } from "../utilities/logger";

/**
 * Serialize user ID into the session (Passport session serialization).
 * Since we use JWT (not sessions), this is a no-op — we just pass through.
 */
passport.serializeUser((user: any, done) => {
  done(null, user._id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await User.findById(id).select("-password");
    done(null, user as any);
  } catch (err) {
    done(err, null);
  }
});

/**
 * Configure the Google OAuth2.0 strategy.
 * If a user with the Google ID exists, log them in.
 * If a user with the same email exists, link the Google account.
 * Otherwise, create a new user.
 */
passport.use(
  new GoogleStrategy(
    {
      clientID: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      callbackURL: env.GOOGLE_CALLBACK_URL || `http://localhost:${env.PORT}/api/auth/google/callback`,
      scope: ["profile", "email"],
      proxy: true,
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const googleId = profile.id;
        const email = profile.emails?.[0]?.value || "";
        const fullName = profile.displayName || "";
        const avatarUrl = profile.photos?.[0]?.value || "";

        // 1. Check if user exists with this Google ID
        let user = await User.findOne({ oauthProvider: "google", oauthId: googleId });

        if (user) {
          // Update avatar if they don't have one or it changed
          if (avatarUrl && (!user.profilePic?.url || user.profilePic.url !== avatarUrl)) {
            user.profilePic = { url: avatarUrl, public_id: "" };
            await user.save();
          }
          return done(null, user as any);
        }

        // 2. Check if a user with this email already exists
        if (email) {
          user = await User.findOne({ email });

          if (user) {
            // Link Google account to existing user
            user.oauthProvider = "google";
            user.oauthId = googleId;
            if (avatarUrl && !user.profilePic?.url) {
              user.profilePic = { url: avatarUrl, public_id: "" };
            }
            await user.save();
            return done(null, user as any);
          }
        }

        // 3. Create a brand new user from Google profile
        // Generate a unique username from the email or display name
        let baseUsername = email.split("@")[0] || fullName.replace(/\s+/g, "").toLowerCase();
        // Remove special characters and ensure valid username
        baseUsername = baseUsername.replace(/[^a-zA-Z0-9_.]/g, "").toLowerCase();
        if (!baseUsername) baseUsername = `user${googleId.slice(-6)}`;

        // Ensure username is unique by appending numbers if needed
        let username = baseUsername;
        let counter = 1;
        while (await User.findOne({ username })) {
          username = `${baseUsername}${counter}`;
          counter++;
        }

        user = new User({
          username,
          fullName,
          email,
          oauthProvider: "google",
          oauthId: googleId,
          profilePic: avatarUrl ? { url: avatarUrl, public_id: "" } : { url: "", public_id: "" },
          isEmailVerified: true,
          // Generate a strong random password for OAuth users.
          // They'll never need this since they log in via Google,
          // but it satisfies the schema minlength:8 validator and
          // gets hashed by the pre-save hook.
          password: randomBytes(32).toString("hex"),
        });

        await user.save();
        return done(null, user as any);
      } catch (err) {
        logger.error("Google OAuth error", { error: err });
        return done(err as Error, undefined);
      }
    },
  ),
);

/**
 * Initiate Google OAuth login.
 * GET /api/auth/google
 */
export const googleAuth = passport.authenticate("google", {
  session: false,
  scope: ["profile", "email"],
});

/**
 * Google OAuth callback.
 * GET /api/auth/google/callback
 *
 * On success, sets JWT cookie and CSRF cookie, then redirects to the frontend.
 * On failure, redirects to the frontend with an error query param.
 */
export const googleAuthCallback = (req: Request, res: Response) => {
  passport.authenticate("google", { session: false }, async (err: any, user: any) => {
    try {
      if (err || !user) {
        logger.error("Google OAuth callback error", { error: err });
        return res.redirect(`${env.CLIENT_URL}/?oauth_error=true`);
      }

      // Generate JWT
      const token = user.signToken();

      // Set JWT cookie
      res.cookie("jwt", token, {
        ...cookieOptions,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: "/",
      });

      // Set CSRF cookie
      setCsrfCookie(res);

      // Redirect back to frontend with success flag
      return res.redirect(`${env.CLIENT_URL}/?oauth_success=true`);
    } catch (error) {
      logger.error("Google OAuth callback handler error", { error });
      return res.redirect(`${env.CLIENT_URL}/?oauth_error=true`);
    }
  })(req, res);
};
