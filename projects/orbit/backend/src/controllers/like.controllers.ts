import type { Request, Response } from "express";
import mongoose from "mongoose";

import Post from "../models/post.model";
import Comment from "../models/comment.model";
import Like from "../models/like.model";
import {
  createNotification,
  deleteInteractionNotification,
} from "../utilities/notification";

type Params = {
  postId: string;
};

type CommentParams = {
  commentId: string;
};

// toggle like for a post
export const togglePostLikes = async (req: Request<Params>, res: Response) => {
  const author = req.user?._id;
  const { postId } = req.params;

  try {
    // check user auth
    if (!author) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized access!",
      });
    }

    // check post id
    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid post ID!",
      });
    }

    // find post
    const post = await Post.findById(postId).select("_id author").lean();

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found!",
      });
    }

    // check if already liked
    const existingLike = await Like.findOne({
      author,
      post: postId,
    });

    if (!existingLike) {
      // like post
      await Like.create({
        author,
        post: postId,
      });

      // increment likes count
      const updatedPost = await Post.findByIdAndUpdate(
        postId,
        { $inc: { likesCount: 1 } },
        { new: true },
      );

      // create notification
      await createNotification({
        recipient: post.author.toString(),
        sender: author.toString(),
        type: "like",
        post: postId,
      });

      return res.status(201).json({
        success: true,
        message: "Post liked successfully!",
        liked: true,
        likesCount: updatedPost?.likesCount,
        post: updatedPost,
      });
    }

    await existingLike.deleteOne();

    await deleteInteractionNotification({
      recipient: post.author.toString(),
      sender: author.toString(),
      type: "like",
      post: postId,
      comment: null,
    });

    // decrement likes count
    const updatedPost = await Post.findByIdAndUpdate(
      postId,
      { $inc: { likesCount: -1 } },
      { new: true },
    );

    return res.status(200).json({
      success: true,
      message: "Post disliked successfully!",
      liked: false,
      likesCount: updatedPost?.likesCount,
      post: updatedPost,
    });
  } catch (err: any) {
    console.log(`Error in togglePostLikes controller! ${err.message}`);

    return res.status(500).json({
      message: "Internal server error!",
    });
  }
};

// toggle like for a comment
export const toggleCommentLikes = async (
  req: Request<CommentParams>,
  res: Response,
) => {
  const author = req.user?._id;
  const { commentId } = req.params;

  try {
    // check user auth
    if (!author) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized access!",
      });
    }

    // check comment id
    if (!mongoose.Types.ObjectId.isValid(commentId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid comment ID!",
      });
    }

    // find comment
    const comment = await Comment.findById(commentId)
      .select("_id author post")
      .lean();

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found!",
      });
    }

    // check if already liked
    const existingLike = await Like.findOne({
      author,
      comment: commentId,
    });

    if (!existingLike) {
      // like comment
      await Like.create({
        author,
        comment: commentId,
      });

      // increment likes count
      const updatedComment = await Comment.findByIdAndUpdate(
        commentId,
        { $inc: { likesCount: 1 } },
        { new: true },
      );

      // create notification
      await createNotification({
        recipient: comment.author.toString(),
        sender: author.toString(),
        type: "like",
        post: comment.post.toString(),
        comment: commentId,
      });

      return res.status(201).json({
        success: true,
        message: "Comment liked successfully!",
        liked: true,
        likesCount: updatedComment?.likesCount,
        comment: updatedComment,
      });
    }

    await existingLike.deleteOne();

    await deleteInteractionNotification({
      recipient: comment.author.toString(),
      sender: author.toString(),
      type: "like",
      post: comment.post.toString(),
      comment: commentId,
    });

    const updatedComment = await Comment.findByIdAndUpdate(
      commentId,
      { $inc: { likesCount: -1 } },
      { new: true },
    );

    return res.status(200).json({
      success: true,
      message: "Comment disliked successfully!",
      liked: false,
      likesCount: updatedComment?.likesCount,
      comment: updatedComment,
    });
  } catch (err: any) {
    console.log(`Error in toggleCommentLikes controller! ${err.message}`);

    return res.status(500).json({
      message: "Internal server error!",
    });
  }
};
