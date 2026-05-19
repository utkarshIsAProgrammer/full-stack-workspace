import type { Request, Response } from "express";
import mongoose from "mongoose";
import { User } from "../models/user.model";
import { deleteAccountSchema } from "../schemas/user.schema";
import { sendDeletionMail } from "../configs/nodeMailer";
import { getCache, setCache, clearUsersCache } from "../configs/cache";

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
    const profile = await User.findById(userId)
      .select("_id viewsCount")
      .lean();
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
