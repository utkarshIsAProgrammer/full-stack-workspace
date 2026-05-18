import type { Request, Response } from "express";
import mongoose from "mongoose";
import Comment from "../models/comment.model";
import Post from "../models/post.model";
import {
  addCommentSchema,
  updateCommentSchema,
} from "../schemas/comment.schema";

type Params = {
  postId: string;
};

type CommentParams = {
  commentId: string;
};

// Get all comments for a specific post
export const getComment = async (req: Request<Params>, res: Response) => {
  const { postId } = req.params;

  try {
    // validate id
    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid post ID!",
      });
    }
    // pagination
    const limit = Math.min(Number(req.query.limit) || 10, 50);
    const cursor = req.query.cursor as string;

    // query
    const query: any = {
      post: postId,
      parent: null,
    };

    // if cursor exists fetch older comments
    if (cursor) {
      query._id = { $lt: cursor };
    }

    // fetch comments with author info
    const comments = await Comment.find(query)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .populate("author", "username");

    // check more comments exists
    const hasMore = comments.length > limit;

    // remove extra comments
    if (hasMore) {
      comments.pop();
    }

    // next cursor
    const nextCursor = comments[comments.length - 1]?._id || null;

    return res.status(200).json({
      success: true,
      comments,
      nextCursor,
      hasMore,
    });
  } catch (err: any) {
    console.log(`Error in getComment: ${err.message}`);

    return res.status(500).json({
      message: "Internal server error!",
    });
  }
};

// create a new comment or reply
export const addComment = async (req: Request, res: Response) => {
  const result = addCommentSchema.safeParse(req.body);
  const postId = req.params.postId;
  const author = req.user?._id;

  try {
    // check validation result
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid Data!",
        error: result.error.issues,
      });
    }

    // check user auth
    if (!author) {
      return res
        .status(401)
        .json({ success: false, message: "Unauthorized access!" });
    }

    // check for parent comment (is reply)
    const parent = result.data.parent;
    if (parent) {
      const parentComment = await Comment.findById(parent);

      if (!parentComment) {
        return res.status(404).json({
          success: false,
          message: "Parent comment not found!",
        });
      }
    }

    // ensure post id
    if (!postId)
      return res
        .status(400)
        .json({ success: false, message: "Post ID required" });

    // save comment
    const comment = new Comment({ ...result.data, author, post: postId });
    await comment.save();

    // increment comments count
    await Post.findByIdAndUpdate(postId, {
      $inc: { commentsCount: 1 },
    });

    res.status(201).json({
      success: true,
      message: "Comment added successfully!",
      comment,
    });
  } catch (err: any) {
    console.log(`Error in the addComment controller! ${err.message}`);
    res.status(500).json({ message: "Internal server error!" });
  }
};

// update existing comment
export const updateComment = async (
  req: Request<CommentParams>,
  res: Response,
) => {
  const result = updateCommentSchema.safeParse(req.body);
  const author = req.user?._id;
  const { commentId } = req.params;

  try {
    // check validation result
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid Data!",
        error: result.error.issues,
      });
    }

    // check user auth
    if (!author) {
      return res
        .status(401)
        .json({ success: false, message: "Unauthorized access!" });
    }

    // find comment (exists)
    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found!",
      });
    }

    // verify ownership
    if (comment.author.toString() !== author.toString()) {
      return res.status(403).json({
        success: false,
        message: "Forbidden!",
      });
    }

    // update and save
    const updatedComment = await Comment.findByIdAndUpdate(
      commentId,
      { content: result.data.content },
      { new: true, runValidators: true },
    );

    res.status(200).json({
      success: true,
      message: "Comment updated successfully!",
      updatedComment,
    });
  } catch (err: any) {
    console.log(`Error in the updateComment controller! ${err.message}`);
    res.status(500).json({ message: "Internal server error!" });
  }
};

// delete comment
export const deleteComment = async (
  req: Request<CommentParams>,
  res: Response,
) => {
  const author = req.user?._id;
  const { commentId } = req.params;

  try {
    // check user auth
    if (!author) {
      return res
        .status(401)
        .json({ success: false, message: "Unauthorized access!" });
    }

    // find comment (exists)
    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found!",
      });
    }

    // verify ownership
    if (comment.author.toString() !== author.toString()) {
      return res.status(403).json({
        success: false,
        message: "Forbidden!",
      });
    }

    // decrement comments count
    await Post.findByIdAndUpdate(comment.post, {
      $inc: { commentsCount: -1 },
    });

    // delete comment
    await comment.deleteOne();

    res.status(200).json({
      success: true,
      message: "Comment deleted successfully!",
    });
  } catch (err: any) {
    console.log(`Error in the deleteComment controller! ${err.message}`);
    res.status(500).json({ message: "Internal server error!" });
  }
};
