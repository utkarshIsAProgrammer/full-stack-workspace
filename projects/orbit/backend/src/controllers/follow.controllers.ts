import type { Request, Response } from "express";
import mongoose from "mongoose";
import { User } from "../models/user.model";
import Follow from "../models/follow.model";
import { getCache, setCache, clearFollowCache } from "../configs/cache";
import {
  createNotification,
  deleteInteractionNotification,
} from "../utilities/notification";

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
    const targetUser = await User.findById(userId).select("_id").lean();

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

      await createNotification({
        recipient: userId,
        sender: follower.toString(),
        type: "follow",
      });

      // clear cache
      await clearFollowCache(userId, follower.toString());

      return res.status(201).json({
        success: true,
        message: "User followed successfully!",
        following: true,
        followersCount: updatedTargetUser?.followersCount,
        follow,
      });
    }

    await existingFollow.deleteOne();

    await deleteInteractionNotification({
      recipient: userId,
      sender: follower.toString(),
      type: "follow",
    });

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

    // clear cache
    await clearFollowCache(userId, follower.toString());

    return res.status(200).json({
      success: true,
      message: "User unfollowed successfully!",
      following: false,
      followersCount: updatedTargetUser?.followersCount,
    });
  } catch (err: any) {
    console.log(`Error in the toggleFollowUser controller! ${err.message}`);

    return res.status(500).json({
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

    // pagination
    const limit = Math.min(Number(req.query.limit) || 10, 50);
    const cursor = req.query.cursor as string;

    // query
    const query: any = {};

    // if cursor exist fetch older data
    if (cursor) {
      query._id = { $lt: cursor };
    }

    // cache key
    const cacheKey = `followers:${userId}:${cursor || "first"}:${limit}`;

    // get from cache
    try {
      const cachedFollowers = await getCache(cacheKey);
      if (cachedFollowers) return res.status(200).json(cachedFollowers);
    } catch (err: any) {
      console.log(`Cache error in getFollowers! ${err.message}`);
    }
    // followers list
    const followers = await Follow.find({
      following: userId,
      ...query,
    })
      .sort({ createdAt: -1 })
      .limit(limit + 1)
      .populate("follower", "username email followersCount followingCount")
      .lean();

    // check more exists
    const hasMore = followers.length > limit;

    // remove extra data
    if (hasMore) {
      followers.pop();
    }

    // next cursor
    const nextCursor = followers[followers.length - 1]?._id || null;

    // followers count
    const followersCount = await Follow.countDocuments({
      following: userId,
    });

    const responseData = {
      success: true,
      followersCount,
      followers,
      nextCursor,
      hasMore,
    };

    // set cache
    try {
      await setCache(cacheKey, responseData, 60);
    } catch (err: any) {
      console.log(`Cache set error in getFollowers! ${err.message}`);
    }

    return res.status(200).json(responseData);
  } catch (err: any) {
    console.log(`Error in getFollowers controller! ${err.message}`);

    return res.status(500).json({
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

    // pagination
    const limit = Math.min(Number(req.query.limit) || 10, 50);
    const cursor = req.query.cursor as string;

    // query
    const query: any = {};

    // if cursor exists fetch old data
    if (cursor) {
      query._id = { $lt: cursor };
    }

    // cache key
    const cacheKey = `following:${userId}:${cursor || "first"}:${limit}`;

    // get from cache
    try {
      const cachedFollowing = await getCache(cacheKey);
      if (cachedFollowing) return res.status(200).json(cachedFollowing);
    } catch (err: any) {
      console.log(`Cache error in getFollowing! ${err.message}`);
    }

    // following list
    const following = await Follow.find({
      follower: userId,
      ...query,
    })
      .sort({ createdAt: -1 })
      .limit(limit + 1)
      .populate("following", "username email followersCount followingCount")
      .lean();

    // check more exists
    const hasMore = following.length > limit;

    // remove extra data
    if (hasMore) {
      following.pop();
    }

    // following count
    const followingCount = await Follow.countDocuments({
      follower: userId,
    });

    // next cursor
    const nextCursor = following[following.length - 1]?._id || null;

    const responseData = {
      success: true,
      followingCount,
      following,
      nextCursor,
      hasMore,
    };

    // set cache
    try {
      await setCache(cacheKey, responseData, 60);
    } catch (err: any) {
      console.log(`Cache set error in getFollowing! ${err.message}`);
    }

    return res.status(200).json(responseData);
  } catch (err: any) {
    console.log(`Error in getFollowing controller! ${err.message}`);

    return res.status(500).json({
      message: "Internal Server Error!",
    });
  }
};
