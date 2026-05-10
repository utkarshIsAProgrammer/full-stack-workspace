import type { Request, Response } from "express";
import { User } from "../models/user.model";
import { signupSchema, loginSchema } from "../schemas/user.schema";
import { sendWelcomeMail } from "../configs/nodeMailer";

// get all users
export const getAll = async (req: Request, res: Response) => {
  try {
    const users = await User.find();
    return res.status(200).json({
      success: true,
      message: "All users fetched successfully!",
      users,
    });
  } catch (err: any) {
    console.log(`Error in the getAll users controller! ${err.message}`);
    res.status(500).json({ message: "Internal server error!" });
  }
};

// signup
export const signup = async (req: Request, res: Response) => {
  const result = signupSchema.safeParse(req.body);

  try {
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid data",
        error: result.error.issues,
      });
    }

    // check user exists
    const userExists = await User.findOne({
      email: result.data.email,
    });

    if (userExists) {
      return res.status(400).json({
        success: false,
        message: "User already exists!",
      });
    }

    // create and save new user
    const user = new User(result.data);
    await user.save();

    // generate jwt and set cookie
    const token = user?.signToken();
    res.cookie("jwt", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // send welcome email
    sendWelcomeMail({
      email: user.email,
      username: user.username,
    });

    res.status(201).json({
      success: true,
      message: "User created successfully!",
      ...user.toObject(),
      password: undefined, // remove password from response
    });
  } catch (err: any) {
    console.log(`Error in the signup controller! ${err.message}`);
    res.status(500).json({ message: "Internal server error!" });
  }
};

// login
export const login = async (req: Request, res: Response) => {
  const result = loginSchema.safeParse(req.body);

  try {
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid data",
        error: result.error.issues,
      });
    }

    // find user
    const user = await User.findOne({
      email: result.data.email,
    });

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User doesn't exists!" });
    }

    // verify password
    const isMatch = await user.comparePassword(result.data.password);
    if (!isMatch) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials!" });
    }

    // generate jwt and set cookie
    const token = user.signToken();
    res.cookie("jwt", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.status(200).json({
      success: true,
      message: "User logged in  successfully!",
      ...user.toObject(),
      password: undefined, // remove password from response
    });
  } catch (err: any) {
    console.log(`Error in the login controller! ${err.message}`);
    res.status(500).json({ message: "Internal server error!" });
  }
};

// logout
export const logout = async (req: Request, res: Response) => {
  try {
    // clear cookie
    res.clearCookie("jwt", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });
    res.status(200).json({
      success: true,
      message: "User logged out successfully!",
    });
  } catch (err: any) {
    console.log(`Error in the logout controller! ${err.message}`);
    res.status(500).json({ message: "Internal server error!" });
  }
};
