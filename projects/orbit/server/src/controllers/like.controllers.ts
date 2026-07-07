import type { Request, Response } from "express";
import mongoose from "mongoose";

import Post from "../models/post.model";
import Comment from "../models/comment.model";
import Like from "../models/like.model";
import {
  createNotification,
  deleteInteractionNotification,
} from "../utilities/notification";
import {
  emitPostLike,
  emitPostUnlike,
  emitCommentLike,
  emitCommentUnlike
} from "../configs/socket";
import { logger } from "../utilities/logger";
import { AppError, BadRequestError, NotFoundError, UnauthorizedError } from "../utilities/errors";
import { toggleLikeSchema, toggleCommentLikeSchema } from "../schemas/interaction.schema";
import { clearFeedCache } from "../configs/cache";

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
    // validate input
    const parsed = toggleLikeSchema.safeParse({ postId });
    if (!parsed.success) {
      throw new BadRequestError(parsed.error.issues[0]?.message || "Invalid input");
    }

    // check user auth
    if (!author) {
      throw new UnauthorizedError("Unauthorized access!");
    }

    // find post
    const post = await Post.findById(postId).select("_id author").lean();

    if (!post) {
      throw new NotFoundError("Post not found!");
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
        { returnDocument: 'after' },
      );

      // create notification
      await createNotification({
        recipient: post.author.toString(),
        sender: author.toString(),
        type: "like",
        post: postId,
      });

      // Emit socket event
      if (updatedPost) {
        emitPostLike(postId, author.toString(), updatedPost.likesCount);
      }

      await clearFeedCache();

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
      { returnDocument: 'after' },
    );

    // Emit socket event
    if (updatedPost) {
      emitPostUnlike(postId, author.toString(), updatedPost.likesCount);
    }

    await clearFeedCache();

    return res.status(200).json({
      success: true,
      message: "Post disliked successfully!",
      liked: false,
      likesCount: updatedPost?.likesCount,
      post: updatedPost,
    });
  } catch (err: any) {
    if (err.statusCode && err.statusCode < 500) throw err;
    logger.error(`Error in togglePostLikes controller!`, { error: err.message });
    throw new AppError("Internal server error!");
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
    // validate input
    const parsed = toggleCommentLikeSchema.safeParse({ commentId });
    if (!parsed.success) {
      throw new BadRequestError(parsed.error.issues[0]?.message || "Invalid input");
    }

    // check user auth
    if (!author) {
      throw new UnauthorizedError("Unauthorized access!");
    }

    // find comment
    const comment = await Comment.findById(commentId)
      .select("_id author post")
      .lean();

    if (!comment) {
      throw new NotFoundError("Comment not found!");
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
        { returnDocument: 'after' },
      );

      // create notification
      await createNotification({
        recipient: comment.author.toString(),
        sender: author.toString(),
        type: "like",
        post: comment.post.toString(),
        comment: commentId,
      });

      // Emit socket event
      if (updatedComment) {
        emitCommentLike(commentId, author.toString(), updatedComment.likesCount);
      }

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
      { returnDocument: 'after' },
    );

    // Emit socket event
    if (updatedComment) {
      emitCommentUnlike(commentId, author.toString(), updatedComment.likesCount);
    }

    return res.status(200).json({
      success: true,
      message: "Comment disliked successfully!",
      liked: false,
      likesCount: updatedComment?.likesCount,
      comment: updatedComment,
    });
  } catch (err: any) {
    if (err.statusCode && err.statusCode < 500) throw err;
    logger.error(`Error in toggleCommentLikes controller!`, { error: err.message });
    throw new AppError("Internal server error!");
  }
};
