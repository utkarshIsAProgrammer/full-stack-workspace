import type { Request, Response } from "express";
import mongoose from "mongoose";
import { User } from "../models/user.model";
import Follow from "../models/follow.model";

type Params = {
  userId: string;
};

// toggle follow/unfollow user
export const toggleFollowUser = async (req: Request<Params>, res: Response) => {
  const follower = req.user?._id;
  const { userId } = req.params;

  try {
    // auth check
    if (!follower) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized access!",
      });
    }

    // validate user id
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID!",
      });
    }

    // prevent self follow
    if (follower.toString() === userId) {
      return res.status(400).json({
        success: false,
        message: "You cannot follow yourself!",
      });
    }

    // check target user exists
    const targetUser = await User.findById(userId);

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: "User not found!",
      });
    }

    // check existing follow
    const existingFollow = await Follow.findOne({
      follower,
      following: userId,
    });

    // follow
    if (!existingFollow) {
      // create follow relation
      const follow = await Follow.create({
        follower,
        following: userId,
      });

      // increment counts
      const updatedTargetUser = await User.findByIdAndUpdate(
        userId,
        {
          $inc: { followersCount: 1 },
        },
        { new: true },
      );

      await User.findByIdAndUpdate(follower, {
        $inc: { followingCount: 1 },
      });

      return res.status(201).json({
        success: true,
        message: "User followed successfully!",
        following: true,
        followersCount: updatedTargetUser?.followersCount,
        follow,
      });
    }

    // unfollow
    await existingFollow.deleteOne();

    const updatedTargetUser = await User.findByIdAndUpdate(
      userId,
      {
        $inc: { followersCount: -1 },
      },
      { new: true },
    );

    await User.findByIdAndUpdate(follower, {
      $inc: { followingCount: -1 },
    });

    return res.status(200).json({
      success: true,
      message: "User unfollowed successfully!",
      following: false,
      followersCount: updatedTargetUser?.followersCount,
    });
  } catch (err: any) {
    console.log(`Error in the toggleFollowUser controller! ${err.message}`);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error!",
    });
  }
};

// get followers list
export const getFollowers = async (req: Request<Params>, res: Response) => {
  const { userId } = req.params;

  try {
    // validate user id
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID!",
      });
    }

    // followers list
    const followers = await Follow.find({
      following: userId,
    })
      .sort({ createdAt: -1 })
      .populate("follower", "username email followersCount followingCount");

    // followers count
    const followersCount = await Follow.countDocuments({
      following: userId,
    });

    return res.status(200).json({
      success: true,
      followersCount,
      followers,
    });
  } catch (err: any) {
    console.log(`Error in getFollowers controller! ${err.message}`);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error!",
    });
  }
};

// get following list
export const getFollowing = async (req: Request<Params>, res: Response) => {
  const { userId } = req.params;

  try {
    // validate user id
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID!",
      });
    }

    // following list
    const following = await Follow.find({
      follower: userId,
    })
      .sort({ createdAt: -1 })
      .populate("following", "username email followersCount followingCount");

    // following count
    const followingCount = await Follow.countDocuments({
      follower: userId,
    });

    return res.status(200).json({
      success: true,
      followingCount,
      following,
    });
  } catch (err: any) {
    console.log(`Error in getFollowing controller! ${err.message}`);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error!",
    });
  }
};
