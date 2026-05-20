import type { Request, Response } from "express";
import { User } from "../models/user.model";
import Post from "../models/post.model";

export const searchUsers = async (req: Request, res: Response) => {
  try {
    // search query
    const q = req.query.q?.toString().trim();
    if (!q) {
      return res.status(400).json({
        success: false,
        message: "Search query required!",
      });
    }

    // pagination
    const limit = Math.min(Number(req.query.limit) || 10, 20);

    // search user
    const users = await User.find({
      $text: { $search: q },
    })
      .select("_id fullName username profilePic followersCount followingCount")
      .sort({ followersCount: -1 })
      .limit(limit)
      .lean();

    return res.status(200).json({
      success: true,
      count: users.length,
      users,
    });
  } catch (err: any) {
    console.log(`Error in the searchUsers controller! ${err.message}`);
    return res.status(500).json({ message: "Internal server error!" });
  }
};

export const searchPosts = async (req: Request, res: Response) => {
  try {
    // query
    const q = req.query.q?.toString().trim();
    if (!q) {
      return res.status(400).json({
        success: false,
        message: "Search query required!",
      });
    }

    // pagination
    const limit = Math.min(Number(req.query.limit) || 10, 20);

    // search post
    const posts = await Post.find({
      $text: { $search: q },
    })
      .select(
        "title image likesCount commentsCount repostsCount createdAt author ",
      )
      .populate("author", "fullName username profilePic")
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return res.status(200).json({
      success: true,
      count: posts.length,
      posts,
    });
  } catch (err: any) {
    console.log(`Error in the searchPosts controller! ${err.message}`);
    return res.status(500).json({ message: "Internal server error!" });
  }
};
