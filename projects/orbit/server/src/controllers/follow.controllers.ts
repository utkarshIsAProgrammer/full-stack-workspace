import type { Request, Response } from "express";
import mongoose from "mongoose";
import { User } from "../models/user.model";
import Follow from "../models/follow.model";
import { getCache, setCache, clearByPattern, clearFollowCache, clearUserByUsernameCache, clearUserByIdCache } from "../configs/cache";
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
    const targetUser = await User.findById(userId).select("_id username").lean();

    if (!targetUser) {
      throw new NotFoundError("User not found!");
    }

    // fetch follower's username to clear their cache too
    const followerUser = await User.findById(follower).select("username").lean();

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
        { returnDocument: 'after' },
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
      if (targetUser?.username) await clearUserByUsernameCache(targetUser.username);
      if (followerUser?.username) await clearUserByUsernameCache(followerUser.username);
      await clearUserByIdCache(userId);
      await clearUserByIdCache(follower.toString());
      await clearByPattern(`users:suggested:${follower.toString()}:*`);
      await clearByPattern(`users:suggested:${userId}:*`);

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
      { returnDocument: 'after' },
    );

    await User.findByIdAndUpdate(follower, {
      $set: { followingCount: actualFollowerFollowing },
    });

    // clear cache
    await clearFollowCache(userId, follower.toString());
    if (targetUser?.username) await clearUserByUsernameCache(targetUser.username);
    if (followerUser?.username) await clearUserByUsernameCache(followerUser.username);
    await clearUserByIdCache(userId);
    await clearUserByIdCache(follower.toString());

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

    let followers: any[] = [];
    let hasMore = false;
    let nextCursor = null;
    let followersCount = 0;
    let isFromCache = false;

    // get from cache
    try {
      const cached: any = await getCache(cacheKey);
      if (cached) {
        followers = cached.followers || [];
        hasMore = cached.hasMore || false;
        nextCursor = cached.nextCursor || null;
        followersCount = cached.followersCount || 0;
        isFromCache = true;
      }
    } catch (err: any) {
      logger.error(`Cache error in getFollowers!`, { error: err.message });
    }

    if (!isFromCache) {
      // followers list
      const rawFollowers = await Follow.find({
        following: userId,
        ...query,
      })
        .sort({ _id: -1 })
        .limit(limit + 1)
        .populate("follower", "_id username fullName profilePic bio followersCount followingCount createdAt")
        .lean();

      // check more exists
      hasMore = rawFollowers.length > limit;

      // remove extra data
      if (hasMore) {
        rawFollowers.pop();
      }

      followers = rawFollowers;
      nextCursor = rawFollowers.slice(-1).shift()?._id || null;
      followersCount = await Follow.countDocuments({ following: userId });

      // set cache (store raw users without personalized follows status)
      try {
        await setCache(cacheKey, {
          followers,
          nextCursor,
          hasMore,
          followersCount,
        }, 60);
      } catch (err: any) {
        logger.error(`Cache set error in getFollowers!`, { error: err.message });
      }
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

    // add isFollowing to each follower dynamically
    const followersWithStatus = followers.map((follow) => ({
      ...follow,
      follower: follow.follower ? {
        ...follow.follower,
        isFollowing: followingSet.has(follow.follower._id.toString()),
      } : null,
    }));

    return res.status(200).json({
      success: true,
      followersCount,
      followers: followersWithStatus,
      nextCursor,
      hasMore,
    });
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

    let following: any[] = [];
    let hasMore = false;
    let nextCursor = null;
    let followingCount = 0;
    let isFromCache = false;

    // get from cache
    try {
      const cached: any = await getCache(cacheKey);
      if (cached) {
        following = cached.following || [];
        hasMore = cached.hasMore || false;
        nextCursor = cached.nextCursor || null;
        followingCount = cached.followingCount || 0;
        isFromCache = true;
      }
    } catch (err: any) {
      logger.error(`Cache error in getFollowing!`, { error: err.message });
    }

    if (!isFromCache) {
      // following list
      const rawFollowing = await Follow.find({
        follower: userId,
        ...query,
      })
        .sort({ _id: -1 })
        .limit(limit + 1)
        .populate("following", "_id username fullName profilePic bio followersCount followingCount createdAt")
        .lean();

      // check more exists
      hasMore = rawFollowing.length > limit;

      // remove extra data
      if (hasMore) {
        rawFollowing.pop();
      }

      following = rawFollowing;
      nextCursor = rawFollowing.slice(-1).shift()?._id || null;
      followingCount = await Follow.countDocuments({ follower: userId });

      // set cache
      try {
        await setCache(cacheKey, {
          following,
          nextCursor,
          hasMore,
          followingCount,
        }, 60);
      } catch (err: any) {
        logger.error(`Cache set error in getFollowing!`, { error: err.message });
      }
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

    // add isFollowing to each following user dynamically
    const followingWithStatus = following.map((follow) => ({
      ...follow,
      following: follow.following ? {
        ...follow.following,
        isFollowing: followingSet.has(follow.following._id.toString()) || (currentUserId && follow.following._id.toString() === currentUserId.toString()),
      } : null,
    }));

    return res.status(200).json({
      success: true,
      followingCount,
      following: followingWithStatus,
      nextCursor,
      hasMore,
    });
  } catch (err: any) {
    if (err.statusCode && err.statusCode < 500) throw err;
    logger.error(`Error in getFollowing controller!`, { error: err.message });
    throw new AppError("Internal server error!");
  }
};
