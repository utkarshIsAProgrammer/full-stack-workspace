import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { User } from "../models/user.model";
import {
  updatePasswordSchema,
  forgotPasswordSchema,
  verifyOtpSchema,
} from "../schemas/user.schema";
import {
  sendPasswordUpdateMail,
  sendForgotPasswordMail,
  sendOtpMail,
} from "../configs/nodeMailer";
import { generateOTP } from "../configs/generateOtp";

// update password
export const updatePassword = async (req: Request, res: Response) => {
  const result = updatePasswordSchema.safeParse(req.body);

  try {
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid data!",
        error: result.error.issues,
      });
    }

    // req.user is populated by protect middleware
    const user = await User.findById(req.user?._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found!",
      });
    }

    // check current password
    const isMatch = await user.comparePassword(result.data.currentPassword);
    if (!isMatch) {
      return res
        .status(401)
        .json({ success: false, message: "Incorrect Password!" });
    }

    // prevent setting same password
    const isSamePassword = await bcrypt.compare(
      result.data.newPassword,
      user.password,
    );
    if (isSamePassword) {
      return res.status(400).json({
        success: false,
        message: "Current password and new password can't be same!",
      });
    }

    // update and save new password (hashed by pre-save hook)
    user.password = result.data.newPassword;
    await user.save();

    // notify via email
    sendPasswordUpdateMail({
      email: user.email,
      username: user.username,
    });

    // clear cookie
    res.clearCookie("jwt", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

    res.status(200).json({
      success: true,
      message: "Password updated successfully!",
    });
  } catch (err: any) {
    console.log(`Error in the updatePassword controller! ${err.message}`);
    res.status(500).json({ message: "Internal server error!" });
  }
};

// request password reset
export const requestOtpForForgotPassword = async (
  req: Request,
  res: Response,
) => {
  const result = forgotPasswordSchema.safeParse(req.body);
  try {
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid Data!",
        error: result.error.issues,
      });
    }

    const user = await User.findOne({ email: result.data.email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found!",
      });
    }

    // generate and hash otp for security
    const otp = generateOTP();
    const hashedOTP = await bcrypt.hash(otp, 10);

    user.otp = hashedOTP;
    user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // Expires in 10 minutes

    await user.save();

    // send raw otp via email
    await sendOtpMail({ email: user.email, username: user.username }, otp);

    // clear cookie
    res.clearCookie("jwt", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

    res.status(200).json({
      success: true,
      message: "OTP sent successfully!",
    });
  } catch (err: any) {
    console.log(`Error in the requestPasswordReset controller! ${err.message}`);
    res.status(500).json({ message: "Internal server error!" });
  }
};

// verify otp and forgot password
export const verifyOtpAndForgotPassword = async (
  req: Request,
  res: Response,
) => {
  const result = verifyOtpSchema.safeParse(req.body);

  try {
    if (!result.success) {
      return res.status(400).json({ message: "Invalid data!" });
    }

    const { email, otp, newPassword } = result.data;

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found!" });

    // check otp exists and valid
    if (!user.otp || !user.otpExpiry) {
      return res.status(400).json({ message: "OTP not found!" });
    }

    if (user.otpExpiry < new Date()) {
      return res.status(400).json({ message: "OTP expired!" });
    }

    const isValid = await bcrypt.compare(otp, user.otp);
    if (!isValid) {
      return res.status(400).json({ message: "Invalid OTP!" });
    }

    // prevent setting same password
    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      return res.status(400).json({
        success: false,
        message: "Current password and new password can't be same!",
      });
    }

    // update password and clear otp fields
    user.password = newPassword;
    user.otp = null;
    user.otpExpiry = null;

    await user.save();

    // notify via email
    await sendForgotPasswordMail({
      email: user.email,
      username: user.username,
    });

    // clear cookie
    res.clearCookie("jwt", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

    res.status(200).json({
      success: true,
      message: "Password reset successfully!",
    });
  } catch (err: any) {
    console.log(
      `Error in the verifyOtpAndResetPassword controller! ${err.message}`,
    );
    res.status(500).json({ message: "Internal server error!" });
  }
};
