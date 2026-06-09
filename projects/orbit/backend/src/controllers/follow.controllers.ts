import type { Request, Response } from "express";
import mongoose from "mongoose";
import { User } from "../models/user.model";
import Follow from "../models/follow.model";
import { getCache, setCache, clearFollowCache } from "../configs/cache";
import {
  createNotification,
  deleteInteractionNotification,
} from "../utilities/notification";
import { logger } from "../utilities/logger";
import { emitFollowUser, emitUnfollowUser } from "../configs/socket";
import { AppError, BadRequestError, NotFoundError, UnauthorizedError } from "../utilities/errors";

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
      throw new UnauthorizedError("Unauthorized access!");
    }

    // validate user id
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new BadRequestError("Invalid user ID!");
    }

    // prevent self follow
    if (follower.toString() === userId) {
      throw new BadRequestError("You cannot follow yourself!");
    }

    // check target user exists
    const targetUser = await User.findById(userId).select("_id").lean();

    if (!targetUser) {
      throw new NotFoundError("User not found!");
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

      // sync counts from Follow collection (authoritative)
      const [actualTargetFollowers, actualFollowerFollowing] = await Promise.all([
        Follow.countDocuments({ following: userId }),
        Follow.countDocuments({ follower }),
      ]);

      const updatedTargetUser = await User.findByIdAndUpdate(
        userId,
        { $set: { followersCount: actualTargetFollowers } },
        { new: true },
      );

      await User.findByIdAndUpdate(follower, {
        $set: { followingCount: actualFollowerFollowing },
      });

      await createNotification({
        recipient: userId,
        sender: follower.toString(),
        type: "follow",
      });

      // clear cache
      await clearFollowCache(userId, follower.toString());

      // emit follow event
      if (updatedTargetUser) {
        emitFollowUser(userId, follower.toString(), updatedTargetUser.followersCount);
      }

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

    // sync counts from Follow collection (authoritative)
    const [actualTargetFollowers, actualFollowerFollowing] = await Promise.all([
      Follow.countDocuments({ following: userId }),
      Follow.countDocuments({ follower }),
    ]);

    const updatedTargetUser = await User.findByIdAndUpdate(
      userId,
      { $set: { followersCount: actualTargetFollowers } },
      { new: true },
    );

    await User.findByIdAndUpdate(follower, {
      $set: { followingCount: actualFollowerFollowing },
    });

    // clear cache
    await clearFollowCache(userId, follower.toString());

    // emit unfollow event
    if (updatedTargetUser) {
      emitUnfollowUser(userId, follower.toString(), updatedTargetUser.followersCount);
    }

    return res.status(200).json({
      success: true,
      message: "User unfollowed successfully!",
      following: false,
      followersCount: updatedTargetUser?.followersCount,
    });
  } catch (err: any) {
    if (err.statusCode && err.statusCode < 500) throw err;
    logger.error(`Error in the toggleFollowUser controller!`, { error: err.message });
    throw new AppError("Internal server error!");
  }
};

// get followers list
export const getFollowers = async (req: Request<Params>, res: Response) => {
  const { userId } = req.params;
  const currentUserId = req.user?._id;

  try {
    // validate user id
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new BadRequestError("Invalid user ID!");
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
      logger.error(`Cache error in getFollowers!`, { error: err.message });
    }
    // followers list
    const followers = await Follow.find({
      following: userId,
      ...query,
    })
      .sort({ _id: -1 })
      .limit(limit + 1)
      .populate("follower", "_id username fullName profilePic bio followersCount followingCount createdAt")
      .lean();

    // check more exists
    const hasMore = followers.length > limit;

    // remove extra data
    if (hasMore) {
      followers.pop();
    }

    // get follower ids to check if current user follows them
    const followerIds = followers.map((f) => f.follower?._id).filter(Boolean);

    // get following status for current user
    const followingSet = new Set<string>();
    if (currentUserId && followerIds.length > 0) {
      const existingFollows = await Follow.find({
        follower: currentUserId,
        following: { $in: followerIds },
      }).lean();

      existingFollows.forEach((follow) => {
        followingSet.add(follow.following.toString());
      });
    }

    // add isFollowing to each follower
    const followersWithStatus = followers.map((follow) => ({
      ...follow,
      follower: follow.follower ? {
        ...follow.follower,
        isFollowing: followingSet.has(follow.follower._id.toString()),
      } : null,
    }));

    // next cursor
    const nextCursor = followers.slice(-1).shift()?._id || null;

    // get actual followers count from Follow collection (authoritative)
    const followersCount = await Follow.countDocuments({ following: userId });

    const responseData = {
      success: true,
      followersCount,
      followers: followersWithStatus,
      nextCursor,
      hasMore,
    };

    // set cache
    try {
      await setCache(cacheKey, responseData, 60);
    } catch (err: any) {
      logger.error(`Cache set error in getFollowers!`, { error: err.message });
    }

    return res.status(200).json(responseData);
  } catch (err: any) {
    if (err.statusCode && err.statusCode < 500) throw err;
    logger.error(`Error in getFollowers controller!`, { error: err.message });
    throw new AppError("Internal server error!");
  }
};

// get following list
export const getFollowing = async (req: Request<Params>, res: Response) => {
  const { userId } = req.params;
  const currentUserId = req.user?._id;

  try {
    // validate user id
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new BadRequestError("Invalid user ID!");
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
      logger.error(`Cache error in getFollowing!`, { error: err.message });
    }

    // following list
    const following = await Follow.find({
      follower: userId,
      ...query,
    })
      .sort({ _id: -1 })
      .limit(limit + 1)
      .populate("following", "_id username fullName profilePic bio followersCount followingCount createdAt")
      .lean();

    // check more exists
    const hasMore = following.length > limit;

    // remove extra data
    if (hasMore) {
      following.pop();
    }

    // get following ids to check if current user follows them
    const followingIds = following.map((f) => f.following?._id).filter(Boolean);

    // get following status for current user
    const followingSet = new Set<string>();
    if (currentUserId && followingIds.length > 0) {
      const existingFollows = await Follow.find({
        follower: currentUserId,
        following: { $in: followingIds },
      }).lean();

      existingFollows.forEach((follow) => {
        followingSet.add(follow.following.toString());
      });
    }

    // add isFollowing to each following user
    const followingWithStatus = following.map((follow) => ({
      ...follow,
      following: follow.following ? {
        ...follow.following,
        isFollowing: followingSet.has(follow.following._id.toString()) || (currentUserId && userId.toString() === currentUserId.toString()),
      } : null,
    }));

    // get actual following count from Follow collection (authoritative)
    const followingCount = await Follow.countDocuments({ follower: userId });

    // next cursor
    const nextCursor = following.slice(-1).shift()?._id || null;

    const responseData = {
      success: true,
      followingCount,
      following: followingWithStatus,
      nextCursor,
      hasMore,
    };

    // set cache
    try {
      await setCache(cacheKey, responseData, 60);
    } catch (err: any) {
      logger.error(`Cache set error in getFollowing!`, { error: err.message });
    }

    return res.status(200).json(responseData);
  } catch (err: any) {
    if (err.statusCode && err.statusCode < 500) throw err;
    logger.error(`Error in getFollowing controller!`, { error: err.message });
    throw new AppError("Internal server error!");
  }
};
