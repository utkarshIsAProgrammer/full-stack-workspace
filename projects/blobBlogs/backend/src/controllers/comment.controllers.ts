import type { Request, Response } from "express";
import Comment from "../models/comment.model";
import { addCommentSchema } from "../schemas/comment.schema";

export const getComment = async (req: Request, res: Response) => {
	try {
		const comments = await Comment.find()
			.sort({ createdAt: -1 })
			.populate("author", "username");

		if (comments.length === 0) {
			return res.status(200).json({
				success: true,
				message: "No comments yet!",
			});
		} else {
			return res.json({
				success: true,
				message: "All comments fetched successfully!",
				comments,
			});
		}
	} catch (err: any) {
		console.log(`Error in the getComment controller! ${err.message}`);
		res.status(500).json({ message: "Internal server error!" });
	}
};

export const addComment = async (req: Request, res: Response) => {
	const result = addCommentSchema.safeParse(req.body);
	const postId = req.params.postId;
	const author = (req as any).user?.userId;

	try {
		if (!result.success) {
			res.status(400).json({
				success: false,
				message: "Invalid Data!",
				error: result.error.issues,
			});
		}

		if (!author) {
			return res
				.status(401)
				.json({ success: false, message: "Unauthorized access!" });
		}

		if (!postId)
			return res
				.status(400)
				.json({ success: false, message: "Post ID required" });

		const comment = new Comment({ ...result.data, author });
		await comment.save();

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

export const updateComment = async (req: Request, res: Response) => {};

export const deleteComment = async (req: Request, res: Response) => {};
