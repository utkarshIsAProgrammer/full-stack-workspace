import type { Request, Response } from "express";
import mongoose from "mongoose";
import { User } from "../models/user.model";
import {
  deleteAccountSchema,
  updateProfileSchema,
} from "../schemas/user.schema";
import cloudinary from "../configs/cloudinary";
import { sendDeletionMail } from "../configs/nodeMailer";
import { getCache, setCache, clearUsersCache } from "../configs/cache";
import Post from "../models/post.model";
import Comment from "../models/comment.model";
import Like from "../models/like.model";
import Follow from "../models/follow.model";
import Save from "../models/saves.model";
import Repost from "../models/repost.model";

type Params = {
  userId: string;
};

// get all users
export const getAll = async (req: Request, res: Response) => {
  try {
    // pagination
    const limit = Math.min(Number(req.query.limit) || 10, 20);
    const cursor = req.query.cursor as string;

    // query
    const query: any = {};

    // if cursor exists fetch older user
    if (cursor) {
      query._id = { $lt: cursor };
    }

    // cache key
    const cacheKey = `users:${cursor || "first"}:${limit}`;

    // get from cache
    try {
      const cachedUsers = await getCache(cacheKey);
      if (cachedUsers) return res.status(200).json(cachedUsers);
    } catch (err: any) {
      console.log(`Cache error in getAll users! ${err.message}`);
    }

    // fetch all users
    const users = await User.find(query)
      .select("-password -otp -otpExpiry")
      .sort({ _id: -1 })
      .limit(limit + 1)
      .lean();
    // .populate("author", "username email");

    // check more user exits
    const hasMore = users.length > limit;

    // remove extra users
    if (hasMore) {
      users.pop();
    }

    // check empty list (user)
    if (users.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No users found!",
      });
    }

    // next cursor
    const nextCursor = users[users.length - 1]?._id || null;

    // prepare response
    const responseData = {
      success: true,
      message: "All users fetched successfully!",
      users,
      nextCursor,
      hasMore,
    };

    // set cache
    try {
      await setCache(cacheKey, responseData, 60);
    } catch (err: any) {
      console.log(`Cache set error in getAll users! ${err.message}`);
    }

    return res.status(200).json(responseData);
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
    
    // delete profile pic and banner image from cloudinary
    if (user.profilePic?.public_id) {
      try {
        await cloudinary.uploader.destroy(user.profilePic.public_id);
      } catch (e) {}
    }
    if (user.bannerImage?.public_id) {
      try {
        await cloudinary.uploader.destroy(user.bannerImage.public_id);
      } catch (e) {}
    }

    // handle orphaned cloudinary images from posts
    const userPosts = await Post.find({ author: userId as any });
    for (const post of userPosts) {
      if (post.image?.public_id) {
        try {
          await cloudinary.uploader.destroy(post.image.public_id);
        } catch (e) {}
      }
    }

    // Delete orphaned data
    await Post.deleteMany({ author: userId as any });
    await Comment.deleteMany({ author: userId as any });
    await Like.deleteMany({ user: userId as any });
    await Save.deleteMany({ user: userId as any });
    await Repost.deleteMany({ user: userId as any });
    await Follow.deleteMany({
      $or: [{ follower: userId as any }, { following: userId as any }],
    });

    await User.findByIdAndDelete(userId);

    // clear users cache
    await clearUsersCache();

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
      message: "Internal server error!",
    });
  }
};

export const viewsCount = async (req: Request<Params>, res: Response) => {
  const { userId } = req.params;
  const currentUser = req.user?._id;

  try {
    // validate post
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user Id!",
      });
    }

    // check post exists
    const profile = await User.findById(userId).select("_id viewsCount").lean();
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
      message: "Internal server error!",
    });
  }
};

// update profile
export const updateProfile = async (req: Request, res: Response) => {
  const result = updateProfileSchema.safeParse(req.body);

  const cleanupFiles = async (filesObj: any) => {
    if (!filesObj) return;
    const files = filesObj as { [fieldname: string]: Express.Multer.File[] };
    const pPic = files.profilePic?.[0];
    const bImg = files.bannerImage?.[0];

    if (pPic?.filename) {
      try {
        await cloudinary.uploader.destroy(pPic.filename);
      } catch (e) {}
    }
    if (bImg?.filename) {
      try {
        await cloudinary.uploader.destroy(bImg.filename);
      } catch (e) {}
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

    const userId = req.user?._id;
    const user = await User.findById(userId);

    if (!user) {
      await cleanupFiles(req.files);
      return res
        .status(404)
        .json({ success: false, message: "User not found!" });
    }

    // check if username exists
    if (result.data.username && result.data.username !== user.username) {
      const userExists = await User.findOne({ username: result.data.username });
      if (userExists) {
        await cleanupFiles(req.files);
        return res
          .status(400)
          .json({ success: false, message: "Username already exists!" });
      }
    }

    const updateData: any = { ...result.data };

    if (req.files) {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      const newProfilePic = files.profilePic?.[0];
      const newBannerImg = files.bannerImage?.[0];

      if (newProfilePic) {
        if (user.profilePic?.public_id) {
          try {
            await cloudinary.uploader.destroy(user.profilePic.public_id);
          } catch (e) {}
        }
        updateData.profilePic = {
          url: newProfilePic.path,
          public_id: newProfilePic.filename,
        };
      }

      if (newBannerImg) {
        if (user.bannerImage?.public_id) {
          try {
            await cloudinary.uploader.destroy(user.bannerImage.public_id);
          } catch (e) {}
        }
        updateData.bannerImage = {
          url: newBannerImg.path,
          public_id: newBannerImg.filename,
        };
      }
    }

    const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
      new: true,
    });

    // update cache
    await clearUsersCache();

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully!",
      user: {
        _id: updatedUser?._id,
        fullName: updatedUser?.fullName,
        username: updatedUser?.username,
        email: updatedUser?.email,
        gender: updatedUser?.gender,
        bio: updatedUser?.bio,
        profilePic: updatedUser?.profilePic,
        bannerImage: updatedUser?.bannerImage,
      },
    });
  } catch (err: any) {
    await cleanupFiles(req.files);
    console.log(`Error in the updateProfile controller! ${err.message}`);
    res.status(500).json({ message: "Internal server error!" });
  }
};
