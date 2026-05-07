import type { Request, Response } from "express";
import Comment from "../models/comment.model";
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

export const getComment = async (req: Request<Params>, res: Response) => {
	const { postId } = req.params;

	try {
		const comments = await Comment.find({ post: postId })
			.sort({ createdAt: -1 })
			.populate("author", "username");

		return res.status(200).json({
			success: true,
			comments,
		});
	} catch (err: any) {
		console.log(`Error in getComment: ${err.message}`);

		return res.status(500).json({
			message: "Internal server error!",
		});
	}
};

export const addComment = async (req: Request, res: Response) => {
	const result = addCommentSchema.safeParse(req.body);
	const postId = req.params.postId;
	const author = req.user?._id;

	try {
		if (!result.success) {
			return res.status(400).json({
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

		const comment = new Comment({ ...result.data, author, post: postId });
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

export const updateComment = async (
	req: Request<CommentParams>,
	res: Response,
) => {
	const result = updateCommentSchema.safeParse(req.body);
	const author = req.user?._id;
	const { commentId } = req.params;

	try {
		if (!result.success) {
			return res.status(400).json({
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

		const comment = await Comment.findById(commentId);
		if (!comment) {
			return res.status(404).json({
				success: false,
				message: "Comment not found!",
			});
		}

		if (comment.author.toString() !== author.toString()) {
			return res.status(403).json({
				success: false,
				message: "Forbidden!",
			});
		}

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

export const deleteComment = async (
	req: Request<CommentParams>,
	res: Response,
) => {
	const author = req.user?._id;
	const { commentId } = req.params;

	try {
		if (!author) {
			return res
				.status(401)
				.json({ success: false, message: "Unauthorized access!" });
		}

		const comment = await Comment.findById(commentId);
		if (!comment) {
			return res.status(404).json({
				success: false,
				message: "Comment not found!",
			});
		}

		if (comment.author.toString() !== author.toString()) {
			return res.status(403).json({
				success: false,
				message: "Forbidden!",
			});
		}

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
