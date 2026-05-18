import type { Request, Response } from "express";
import mongoose from "mongoose";
import Post from "../models/post.model";
import Save from "../models/saves.model";

type Params = {
  postId: string;
};

export const toggleSavePost = async (req: Request<Params>, res: Response) => {
  const { postId } = req.params;
  const userId = (req as any).user?._id;

  try {
    //  check user auth
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized!" });
    }

    //  check post id
    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid post id!",
      });
    }

    // check post exists
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found!",
      });
    }

    // check user already saved this post
    const alreadySaved = await Save.findOne({
      user: userId,
      post: postId,
    });

    // unsave post
    if (alreadySaved) {
      await alreadySaved.deleteOne();

      // decrement saves count
      const updatedPost = await Post.findByIdAndUpdate(
        postId,
        { $inc: { savesCount: -1 } },
        { new: true },
      );

      return res.status(200).json({
        success: true,
        message: "Post unsaved!",
        saved: false,
        savesCount: updatedPost?.savesCount,
        post: updatedPost,
      });
    }

    // save post
    await Save.create({
      user: userId,
      post: postId,
    });

    // increment saves count
    const updatedPost = await Post.findByIdAndUpdate(
      postId,
      { $inc: { savesCount: 1 } },
      { new: true },
    );

    res.status(201).json({
      success: true,
      message: "Post saved!",
      saved: true,
      savesCount: updatedPost?.savesCount,
      post: updatedPost,
    });
  } catch (err: any) {
    console.log(`Error in the toggleSavePost controller! ${err.message}`);
    res.status(500).json({ success: true, message: "Internal server error!" });
  }
};

export const getSavedPosts = async (req: Request, res: Response) => {
  const userId = (req as any).user?._id;

  try {
    //  check user auth
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized!",
      });
    }

    // pagination
    const limit = Math.min(Number(req.query.limit) || 10, 50);
    const cursor = req.query.cursor as string;

    // query
    const query: any = {
      user: userId,
    };

    // if cursor exists fetch older saves
    if (cursor) {
      query._id = {
        $lt: cursor,
      };
    }

    // find saved posts
    const savedPosts = await Save.find({ query })
      .sort({ _id: -1 })
      .limit(limit + 1)
      .populate({
        path: "post",
        select:
          "title slug image author savesCount repostsCount  likesCount commentsCount",
        populate: [
          {
            path: "author",
            select: "username fullName email",
          },
        ],
      });

    // no posts saved
    if (savedPosts.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No saved posts!",
        saved: true,
      });
    }

    // check has more
    const hasMore = savedPosts.length > limit;

    // remove extra item
    if (hasMore) {
      savedPosts.pop();
    }

    // next cursor
    const nextCursor = savedPosts[savedPosts.length - 1]?._id || null;

    res.status(200).json({
      success: true,
      message: "Saved posts fetched successfully!",
      count: savedPosts.length,
      savedPosts,
      nextCursor,
      hasMore,
    });
  } catch (err: any) {
    console.log(`Error in the getSavedPosts controller! ${err.message}`);
    res.status(500).json({ success: false, message: "Internal server error!" });
  }
};
