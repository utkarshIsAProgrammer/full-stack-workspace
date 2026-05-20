import mongoose, { InferSchemaType, HydratedDocument } from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

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
      required: true,
      enum: ["male", "female", "others"],
      lowercase: true,
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
  },

  { timestamps: true },
);

userSchema.index({ username: "text", fullName: "text" });

// password hashing
userSchema.pre("save", async function () {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified("password")) {
    return;
  }

  this.password = await bcrypt.hash(this.password, 10);
});

// jwt generation
userSchema.methods.signToken = function () {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET not defined");
  }
  return jwt.sign({ userId: this._id }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
};

// password verification
userSchema.methods.comparePassword = function (password: string) {
  return bcrypt.compare(password, this.password);
};

type UserType = InferSchemaType<typeof userSchema>;
export type UserDocument = HydratedDocument<UserType> & {
  otp?: string | null;
  otpExpiry?: Date | null;
  signToken: () => string;
  comparePassword: (password: string) => Promise<boolean>;
};

// user model
export const User = mongoose.model<UserDocument>("User", userSchema);
