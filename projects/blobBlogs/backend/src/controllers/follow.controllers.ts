import type { Request, Response } from "express";
import mongoose from "mongoose";
import { User } from "../models/user.model";
import Follow from "../models/follow.model";

type Params = {
  userId: string;
  following: string;
};

// toggle follow status for a user
export const toggleFollowUser = async (req: Request<Params>, res: Response) => {
  const follower = req.user?._id;
  const { userId } = req.params;

  try {
    // check user auth
    if (!follower) {
      return res
        .status(401)
        .json({ success: false, message: "Unauthorized access!" });
    }

    // check user id
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID!",
      });
    }

    // self follow check
    if (follower.toString() === userId) {
      return res.status(400).json({
        success: false,
        message: "You cannot follow yourself!",
      });
    }

    // find user
    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found!" });
    }

    // follow check
    const existingFollow = await Follow.findOne({
      follower,
      following: userId,
    });
    if (!existingFollow) {
      // follow user
      const follow = await Follow.create({
        follower,
        following: userId,
      });

      return res.status(201).json({
        success: true,
        message: "User followed successfully!",
        following: true,
        follow,
      });
    }

    // unfollow
    await Follow.findByIdAndDelete(existingFollow._id);

    return res.status(200).json({
      success: true,
      message: "User unfollowed successfully!",
      following: false,
    });
  } catch (err: any) {
    console.log(`Error in the toggleFollowUser controller! ${err.message}`);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// get followers list for a user
export const getFollowers = async (req: Request<Params>, res: Response) => {
  const { userId } = req.params;

  try {
    // find followers
    const followers = await Follow.find({
      following: userId,
    }).populate("follower", "username email");

    // count followers
    const followersCount = await Follow.countDocuments({
      following: userId,
    });

    res.json({
      success: true,
      followersCount,
      followers,
    });
  } catch (err: any) {
    console.log(`Error in the getFollowers controller! ${err.message}`);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// get following list for a user
export const getFollowing = async (req: Request<Params>, res: Response) => {
  const { userId } = req.params;

  try {
    // find following
    const following = await Follow.find({
      follower: userId,
    }).populate("following", "username email");

    // count following
    const followingCount = await Follow.countDocuments({
      follower: userId,
    });

    res.json({
      success: true,
      followingCount,
      following,
    });
  } catch (err: any) {
    console.log(`Error in the getFollowing controller! ${err.message}`);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
