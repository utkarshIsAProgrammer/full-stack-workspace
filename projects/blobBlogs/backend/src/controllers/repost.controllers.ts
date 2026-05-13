import type { Request, Response } from "express";
import mongoose from "mongoose";
import Repost from "../models/repost.model";
import Post from "../models/post.model";

type Params = {
  postId: string;
};

export const toggleRepost = async (req: Request<Params>, res: Response) => {
  const userId = (req as any).user?._id;
  const { postId } = req.params;

  try {
    // auth check
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized!",
      });
    }

    // validate post id
    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid post id!",
      });
    }

    // find post
    const post = await Post.findById(postId);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found!",
      });
    }

    // check existing repost
    const existingRepost = await Repost.findOne({
      user: userId,
      post: postId,
    });

    // un-repost post
    if (existingRepost) {
      await existingRepost.deleteOne();

      const updatedPost = await Post.findByIdAndUpdate(
        postId,
        { $inc: { repostsCount: -1 } },
        { new: true },
      );

      return res.status(200).json({
        success: true,
        message: "Post un-reposted!",
        reposted: false,
        repostsCount: updatedPost?.repostsCount,
        post: updatedPost,
      });
    }

    // re-post post
    await Repost.create({
      user: userId,
      post: postId,
    });

    // increment repost count
    const updatedPost = await Post.findByIdAndUpdate(
      postId,
      { $inc: { repostsCount: 1 } },
      { new: true },
    );

    return res.status(201).json({
      success: true,
      message: "Post reposted!",
      reposted: true,
      repostsCount: updatedPost?.repostsCount,
      post: updatedPost,
    });
  } catch (err: any) {
    console.log(`Error in toggleRepost controller! ${err.message}`);

    return res.status(500).json({
      success: false,
      message: "Internal server error!",
    });
  }
};
