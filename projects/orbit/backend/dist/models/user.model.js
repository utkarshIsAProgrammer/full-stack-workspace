"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.User = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../configs/env");
// user schema
const userSchema = new mongoose_1.default.Schema({
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
        type: [{
                type: mongoose_1.default.Schema.Types.ObjectId,
                ref: "Post",
            }],
        default: [],
        validate: {
            validator: function (v) { return v.length <= 3; },
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
    // email verification status
    isEmailVerified: {
        type: Boolean,
        default: true,
    },
    // password history for preventing reuse (stores last 5 hashed passwords)
    passwordHistory: {
        type: [{
                password: String,
                changedAt: Date,
            }],
        default: [],
    },
}, { timestamps: true });
// indexes for optimal query performance
userSchema.index({ username: "text", fullName: "text" });
userSchema.index({ createdAt: -1 });
userSchema.index({ username: 1 }, { unique: true });
userSchema.index({ email: 1 }, { unique: true });
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
    const costFactor = env_1.env.NODE_ENV === "production" ? 12 : 10;
    this.password = await bcryptjs_1.default.hash(this.password, costFactor);
});
// jwt generation
userSchema.methods.signToken = function () {
    return jsonwebtoken_1.default.sign({ userId: this._id }, env_1.env.JWT_SECRET, {
        expiresIn: "7d",
        issuer: "orbit",
        audience: "orbit-users",
    });
};
// password verification
userSchema.methods.comparePassword = function (password) {
    return bcryptjs_1.default.compare(password, this.password);
};
// user model
exports.User = mongoose_1.default.model("User", userSchema);
//# sourceMappingURL=user.model.js.map