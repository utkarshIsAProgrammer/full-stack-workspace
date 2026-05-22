import type { Request, Response } from "express";
import { User } from "../models/user.model";
import { signupSchema, loginSchema } from "../schemas/user.schema";
import { sendWelcomeMail } from "../configs/nodeMailer";
import jwt from "jsonwebtoken";
import { cookieOptions } from "../configs/cookie";
import cloudinary from "../configs/cloudinary";

// signup
export const signup = async (req: Request, res: Response) => {
  const result = signupSchema.safeParse(req.body);

  const cleanupFiles = async (filesObj: any) => {
    if (!filesObj) return;
    const files = filesObj as { [fieldname: string]: Express.Multer.File[] };
    const pPic = files.profilePic?.[0];
    const bImg = files.bannerImage?.[0];
    
    if (pPic?.filename) {
      try { await cloudinary.uploader.destroy(pPic.filename); } catch (e) {}
    }
    if (bImg?.filename) {
      try { await cloudinary.uploader.destroy(bImg.filename); } catch (e) {}
    }
  };

  try {
    if (!result.success) {
      await cleanupFiles(req.files);
      return res.status(400).json({
        success: false,
        message: "Invalid data",
        error: result.error.issues,
      });
    }

    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const profilePic = files?.profilePic?.[0];
    const bannerImage = files?.bannerImage?.[0];

    if (!profilePic) {
      await cleanupFiles(req.files);
      return res.status(400).json({
        success: false,
        message: "Profile picture is required!",
      });
    }

    // check user exists
    const userExists = await User.findOne({
      $or: [{ email: result.data.email }, { username: result.data.username }],
    });

    if (userExists) {
      await cleanupFiles(req.files);
      if (userExists.email === result.data.email) {
        return res.status(400).json({
          success: false,
          message: "Email already exists!",
        });
      }
      return res.status(400).json({
        success: false,
        message: "Username already exists!",
      });
    }

    const userData: any = {
      ...result.data,
      profilePic: {
        url: profilePic.path,
        public_id: profilePic.filename,
      },
    };

    if (bannerImage) {
      userData.bannerImage = {
        url: bannerImage.path,
        public_id: bannerImage.filename,
      };
    }

    // create and save new user
    const user = new User(userData);
    await user.save();

    // generate jwt and set cookie
    const token = user?.signToken();
    res.cookie("jwt", token, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    void sendWelcomeMail({
      email: user.email,
      username: user.username,
    });

    return res.status(201).json({
      success: true,
      message: "User created successfully!",
      user: {
        _id: user._id,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        gender: user.gender,
        bio: user.bio,
        profilePic: user.profilePic,
        bannerImage: user.bannerImage,
        followersCount: user.followersCount,
        followingCount: user.followingCount,
        createdAt: user.createdAt,
      },
    });
  } catch (err: any) {
    if (req.file) {
      try {
        await cloudinary.uploader.destroy(req.file.filename);
      } catch (cloudErr) {
        console.log("Cloudinary destroy error: ", cloudErr);
      }
    }
    console.log(`Error in the signup controller! ${err.message}`);
    res.status(500).json({ message: "Internal server error!" });
  }
};

// login
export const login = async (req: Request, res: Response) => {
  const result = loginSchema.safeParse(req.body);

  try {
    // validate input
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid data",
        error: result.error.issues,
      });
    }

    // check existing jwt cookie
    const existingToken = req.cookies?.jwt;

    if (existingToken) {
      try {
        jwt.verify(existingToken, process.env.JWT_SECRET!);

        return res.status(400).json({
          success: false,
          message: "You are already logged in!",
        });
      } catch (err: any) {
        console.log(`Invalid/expired token! ${err.message}`);
        res.clearCookie("jwt", cookieOptions);
      }
    }

    // find user
    const user = await User.findOne({
      email: result.data.email,
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User doesn't exist!",
      });
    }

    // verify password
    const isMatch = await user.comparePassword(result.data.password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials!",
      });
    }

    // generate jwt
    const token = user.signToken();

    // set cookie
    res.cookie("jwt", token, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // response
    return res.status(200).json({
      success: true,
      message: "User logged in successfully!",
      user: {
        _id: user._id,
        fullName: user.fullName,
        username: user.username,
        email: user.email,
        gender: user.gender,
        bio: user.bio,
        profilePic: user.profilePic,
        bannerImage: user.bannerImage,
        followersCount: user.followersCount,
        followingCount: user.followingCount,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (err: any) {
    console.log(`Error in the login controller! ${err.message}`);

    return res.status(500).json({
      message: "Internal server error!",
    });
  }
};

// logout
export const logout = async (req: Request, res: Response) => {
  try {
    // clear cookie
    res.clearCookie("jwt", cookieOptions);
    res.status(200).json({
      success: true,
      message: "User logged out successfully!",
    });
  } catch (err: any) {
    console.log(`Error in the logout controller! ${err.message}`);
    res.status(500).json({ message: "Internal server error!" });
  }
};
