import mongoose from "mongoose";
import type { Request, Response } from "express";
import Post from "../models/post.model";
import { createPostSchema, updatePostSchema } from "../schemas/post.schema";

type Params = {
  id: string;
};

// get single post by id
export const getPost = async (req: Request<Params>, res: Response) => {
  const { id } = req.params;

  try {
    // check post id
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ID!",
      });
    }

    // fetch post
    const post = await Post.findOne({ _id: id }).populate(
      "author",
      "username email",
    );
    if (!post) {
      return res
        .status(404)
        .json({ success: false, message: "Post not found!" });
    }

    res.status(200).json({
      success: true,
      message: "Post fetched successfully!",
      post,
    });
  } catch (err: any) {
    console.log(`Error in the getPost controller! ${err.message}`);
    res.status(500).json({ message: "Internal server error!" });
  }
};

// get all posts
export const getAllPosts = async (req: Request, res: Response) => {
  try {
    // fetch posts
    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .populate("author", "username email");
    if (posts.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No posts yet!",
      });
    } else {
      return res.status(200).json({
        success: true,
        message: "All posts fetched successfully!",
        posts,
      });
    }
  } catch (err: any) {
    console.log(`Error in the getAllPosts controller! ${err.message}`);
    res.status(500).json({ message: "Internal server error!" });
  }
};

// create new post
export const createPost = async (req: Request, res: Response) => {
  // validate input
  const result = createPostSchema.safeParse(req.body);

  try {
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid input!",
        error: result.error.issues,
      });
    }

    // check user auth
    const author = (req as any).user?._id;
    if (!author) {
      return res
        .status(401)
        .json({ success: false, message: "Unauthorized access!" });
    }

    // save post
    const post = new Post({ ...result.data, author });
    await post.save();

    return res.status(201).json({
      success: true,
      message: "Post created successfully!",
      post,
    });
  } catch (err: any) {
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Duplicate slug, try different title",
      });
    }

    console.log(`Error in the createPost controller! ${err.message}`);
    res.status(500).json({ message: "Internal server error!" });
  }
};

// update existing post
export const updatePost = async (req: Request<Params>, res: Response) => {
  const { id } = req.params;

  // validate input
  const result = updatePostSchema.safeParse(req.body);
  const userId = (req as any).user?._id;

  try {
    // check post id
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ID!",
      });
    }

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid input!",
        error: result.error.issues,
      });
    }

    // check user auth
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized!",
      });
    }

    // find post
    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found!",
      });
    }

    // verify ownership
    if (post.author.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Forbidden!",
      });
    }

    // save updates
    const { title, content } = result.data;
    if (title !== undefined) post.title = title;
    if (content !== undefined) post.content = content;
    await post.save();

    res.status(200).json({
      success: true,
      message: "Post updated successfully!",
      post,
    });
  } catch (err: any) {
    console.log(`Error in the updatePost controller!`);
    res.status(500).json({ message: "Internal server error!" });
  }
};

// delete a post
export const deletePost = async (req: Request<Params>, res: Response) => {
  const { id } = req.params;
  const userId = (req as any).user?._id;

  try {
    // check post id
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ID!",
      });
    }

    // check user auth
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized!",
      });
    }

    // find post
    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found!",
      });
    }

    // verify ownership
    if (post.author.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Forbidden!",
      });
    }

    // delete post
    await post.deleteOne();

    res.status(200).json({
      success: true,
      message: "Post deleted successfully!",
    });
  } catch (err: any) {
    console.log(`Error in the deletePost controller!`);
    res.status(500).json({ message: "Internal server error!" });
  }
};
