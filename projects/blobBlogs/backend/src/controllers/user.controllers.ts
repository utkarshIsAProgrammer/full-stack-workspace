import type { Request, Response } from "express";
import mongoose from "mongoose";
import { User } from "../models/user.model";
import { deleteAccountSchema } from "../schemas/user.schema";
import { sendDeletionMail } from "../configs/nodeMailer";

type Params = {
  userId: string;
};

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

// delete account
export const deleteAccount = async (req: Request, res: Response) => {
  const result = deleteAccountSchema.safeParse(req.body);

  try {
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid Data!",
      });
    }

    // find user and verify credentials
    const user = await User.findOne({ email: result.data.email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found!",
      });
    }

    const isMatch = await user.comparePassword(result.data.password);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Invalid credentials!",
      });
    }

    // get user id from the auth middleware
    const userId = req.user?._id;
    await User.findByIdAndDelete(userId);

    // send account deletion email
    sendDeletionMail({
      email: user.email,
      username: user.username,
    });

    res.status(200).json({
      success: true,
      message: "Account deleted successfully!",
    });
  } catch (err: any) {
    console.log(`Error in the deleteAccount controller! ${err.message}`);
    res.status(500).json({ message: "Internal server error!" });
  }
};

// share profile
export const shareProfile = async (req: Request<Params>, res: Response) => {
  const { userId } = req.params;

  try {
    // validate id
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user id!",
      });
    }

    // increment share count
    const user = await User.findByIdAndUpdate(
      userId,
      {
        $inc: { sharesCount: 1 },
      },
      { new: true },
    );
    if (!user) {
      return res.status(400).json({
        success: false,
        message: "User not found!",
      });
    }

    // generate url
    const shareUrl = `${process.env.CLIENT_URL}/user/${user.username}`;

    res.status(200).json({
      success: true,
      message: "Profile shared successfully!",
      shares: user.sharesCount,
      shareUrl,
    });
  } catch (err: any) {
    console.log(`Error in the shareProfile controller! ${err.message}`);
    res.status(500).json({
      success: false,
      message: "Internal server error!",
    });
  }
};

export const viewsCount = async (req: Request<Params>, res: Response) => {
  const { userId } = req.params;
  const currentUser = (req as any).user?._id;

  try {
    // validate post
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user Id!",
      });
    }

    // check post exists
    const profile = await User.findById(userId);
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Profile not found!",
      });
    }

    // check self view
    if (currentUser && profile._id.toString() === currentUser.toString()) {
      return res.status(200).json({
        success: true,
        message: "Own profile view ignored!",
        views: profile.viewsCount,
      });
    }

    // increment profile views count
    const updatedProfile = await User.findByIdAndUpdate(
      userId,
      {
        $inc: { viewsCount: 1 },
      },
      { new: true },
    );

    res.status(200).json({
      success: true,
      message: "View counted successfully!",
      views: updatedProfile?.viewsCount,
    });
  } catch (err: any) {
    console.log(`Error in the viewsCount controller! ${err.message}`);
    res.status(500).json({
      success: false,
      message: "Internal server error!",
    });
  }
};
