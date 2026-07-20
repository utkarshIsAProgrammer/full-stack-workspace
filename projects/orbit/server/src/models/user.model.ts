import mongoose, { InferSchemaType, HydratedDocument } from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../configs/env";

// user schema
const userSchema = new mongoose.Schema(
	{
		// username
		username: {
			type: String,
			required: [true, "Username is required!"],
			minlength: [3, "Username must be at least 3 characters long!"],
			maxlength: [100, "Username must be less than 100 characters!"],
			trim: true,
			unique: true,
			lowercase: true,
		},

		// fullname
		fullName: {
			type: String,
			required: [true, "Full name is required!"],
			maxlength: 50,
			trim: true,
		},

		// gender
		gender: {
			type: String,
			enum: ["male", "female", "others"],
			lowercase: true,
			default: "others",
		},

		// profile bio
		bio: {
			type: String,
			maxlength: 300,
			default: "",
		},

		// profile pic
		profilePic: {
			url: {
				type: String,
				default: "",
			},

			public_id: {
				type: String,
				default: "",
			},
		},

		// banner image
		bannerImage: {
			url: {
				type: String,
				default: "",
			},

			public_id: {
				type: String,
				default: "",
			},
		},

		// email
		email: {
			type: String,
			required: [true, "Email is required!"],
			trim: true,
			lowercase: true,
			unique: true,
		},

		// hashed password
		password: {
			type: String,
			required: [true, "Password is required!"],
			minlength: [8, "Password must be at least 8 characters long!"],
		},

		// user followers
		followersCount: {
			type: Number,
			default: 0,
		},

		// user following
		followingCount: {
			type: Number,
			default: 0,
		},

		// share count
		sharesCount: {
			type: Number,
			default: 0,
		},

		// views count
		viewsCount: {
			type: Number,
			default: 0,
		},

		// pinned post IDs (max 3)
		pinnedPosts: {
			type: [
				{
					type: mongoose.Schema.Types.ObjectId,
					ref: "Post",
				},
			],
			default: [],
			validate: {
				validator: function (v: any[]) {
					return v.length <= 3;
				},
				message: "Maximum 3 pinned posts allowed!",
			},
		},

		// login attemps for brute force protection
		loginAttempts: {
			type: Number,
			default: 0,
		},

		// lock until (date) - if set, user cannot login
		lockUntil: {
			type: Date,
			default: null,
		},

		// verification otp
		otp: {
			type: String,
			default: null,
		},

		// otp expiry
		otpExpiry: {
			type: Date,
			default: null,
		},

		// otp attempts for abuse prevention
		otpAttempts: {
			type: Number,
			default: 0,
		},

		// when otp lockout expires
		otpLockedUntil: {
			type: Date,
			default: null,
		},

		// email verification status
		isEmailVerified: {
			type: Boolean,
			default: true,
		},

		// password history for preventing reuse (stores last 5 hashed passwords)
		passwordHistory: {
			type: [
				{
					password: String,
					changedAt: Date,
				},
			],
			default: [],
		},

		// Private account (follow requests required)
		isPrivate: {
			type: Boolean,
			default: false,
		},

		// Push notifications enabled
		notificationsEnabled: {
			type: Boolean,
			default: true,
		},

		// Onboarding completed
		isOnboarded: {
			type: Boolean,
			default: false,
		},

		// Follow request IDs (for private accounts)
		followRequests: [
			{
				type: mongoose.Schema.Types.ObjectId,
				ref: "User",
			},
		],

		// Admin flag
		isAdmin: {
			type: Boolean,
			default: false,
		},

		// Muted users (user -> mute metadata)
		mutedUsers: {
			type: [{
				user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
				mutedAt: { type: Date, default: Date.now },
				expiresAt: { type: Date },
			}],
			default: [],
		},

		// Close friends list
		closeFriends: [{
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
		}],

		// Mute/ban status
		isMuted: {
			type: Boolean,
			default: false,
		},
		isBanned: {
			type: Boolean,
			default: false,
		},

		// ─── Feed ranking fields (used by the affinity engine) ─────────────

		// Cached per-author affinity scores (authorId -> score).
		// Re-computed by a scheduled job, not on every feed request.
		affinityScores: {
			type: Map,
			of: Number,
			default: new Map(),
		},

		// Cached per-tag / content-type affinity (tag -> score).
		// Helps the feed rank higher posts on topics the user engages with.
		contentAffinity: {
			type: Map,
			of: Number,
			default: new Map(),
		},

		// Timestamp of the last affinity recomputation for this user.
		affinityUpdatedAt: {
			type: Date,
			default: null,
		},

		// Set of post IDs the user has recently viewed.
		// Used to exclude already-seen posts from the feed pool.
		// Managed as a capped array — oldest entries are evicted when length > 500.
		seenPosts: {
			type: [String],
			default: [],
		},
	},

	{ timestamps: true },
);

// indexes for optimal query performance
userSchema.index({ username: "text", fullName: "text" });
userSchema.index({ createdAt: -1 });
// username already has unique: true declared in the field definition
// email already has unique: true declared in the field definition
userSchema.index({ followersCount: -1 });
userSchema.index({ followingCount: -1 });
userSchema.index({ createdAt: -1, _id: -1 });

// password hashing
userSchema.pre("save", async function () {
	// Only hash the password if it has been modified (or is new)
	if (!this.isModified("password")) {
		return;
	}

	// Use stronger bcrypt cost factor for production
	const costFactor = env.NODE_ENV === "production" ? 12 : 10;
	this.password = await bcrypt.hash(this.password, costFactor);
});

// jwt generation
userSchema.methods.signToken = function () {
	return jwt.sign({ userId: this._id }, env.JWT_SECRET, {
		expiresIn: "7d",
		issuer: "orbit",
		audience: "orbit-users",
	});
};

// password verification
userSchema.methods.comparePassword = function (password: string) {
	return bcrypt.compare(password, this.password);
};

type UserType = InferSchemaType<typeof userSchema>;
export type UserDocument = HydratedDocument<UserType> & {
	pinnedPosts?: mongoose.Types.ObjectId[];
	loginAttempts?: number;
	lockUntil?: Date | null;
	otp?: string | null;
	otpExpiry?: Date | null;
	otpAttempts?: number;
	otpLockedUntil?: Date | null;
	signToken: () => string;
	comparePassword: (password: string) => Promise<boolean>;
};

// user model
export const User = mongoose.model<UserDocument>("User", userSchema);
