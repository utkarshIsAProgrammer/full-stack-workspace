import mongoose from "mongoose";
import type { Request, Response } from "express";
import Post from "../models/post.model";
import { postSchema } from "../schemas/post.schema";

type Params = {
	id: string;
};

export const getPost = async (req: Request<Params>, res: Response) => {
	const { id } = req.params;

	try {
		if (!mongoose.Types.ObjectId.isValid(id)) {
			return res.status(400).json({
				success: false,
				message: "Invalid ID!",
			});
		}

		const post = await Post.findOne({ _id: id, published: true }).populate(
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

export const getAllPosts = async (req: Request, res: Response) => {
	try {
		const posts = await Post.find({ published: true })
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

export const createPost = async (req: Request, res: Response) => {
	const result = postSchema.safeParse(req.body);

	try {
		if (!result.success) {
			return res.status(400).json({
				success: false,
				message: "Invalid input!",
				error: result.error.issues,
			});
		}

		const author = (req as any).user?._id;
		if (!author) {
			return res
				.status(401)
				.json({ success: false, message: "Unauthorized access!" });
		}

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

export const updatePost = async (req: Request, res: Response) => {};

export const deletePost = async (req: Request, res: Response) => {};
