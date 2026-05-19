"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.User = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
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
    },
    // email
    email: {
        type: String,
        required: [true, "Email is required!"],
        trim: true,
        lowercase: true,
        unique: true,
        index: true,
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
    // verification otp
    otp: {
        type: String,
        default: null,
    },
    // otp expiry
    otpExpiry: {
        type: Date,
        default: null,
        index: { expires: 0 },
    },
}, { timestamps: true });
// password hashing
userSchema.pre("save", async function () {
    // Only hash the password if it has been modified (or is new)
    if (!this.isModified("password")) {
        return;
    }
    this.password = await bcryptjs_1.default.hash(this.password, 10);
});
// jwt generation
userSchema.methods.signToken = function () {
    if (!process.env.JWT_SECRET) {
        throw new Error("JWT_SECRET not defined");
    }
    return jsonwebtoken_1.default.sign({ userId: this._id }, process.env.JWT_SECRET, {
        expiresIn: "7d",
    });
};
// password verification
userSchema.methods.comparePassword = function (password) {
    return bcryptjs_1.default.compare(password, this.password);
};
// user model
exports.User = mongoose_1.default.model("User", userSchema);
//# sourceMappingURL=user.model.js.map