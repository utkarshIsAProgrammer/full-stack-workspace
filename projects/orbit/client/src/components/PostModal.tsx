import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Image, Loader2 } from "lucide-react";
import { apiFetch } from "../utils/api";
import { logger } from "../utils/logger";
import { validatePost } from "../utils/validation";
import ValidationMessage from "./ValidationMessage";
import CharCounter from "./CharCounter";
import ImageCropModal from "./ImageCropModal";

interface PostModalProps {
	isOpen: boolean;
	onClose: () => void;
	onPostCreated: () => void;
}

export default function PostModal({
	isOpen,
	onClose,
	onPostCreated,
}: PostModalProps) {
	const [title, setTitle] = useState("");
	const [content, setContent] = useState("");
	const [postImageFiles, setPostImageFiles] = useState<File[]>([]);
	const [postImagePreviews, setPostImagePreviews] = useState<string[]>([]);
	const [submittingPost, setSubmittingPost] = useState(false);

	// Crop queue for sequential multi-image cropping
	const [cropQueue, setCropQueue] = useState<string[]>([]);
	const [cropQueueNames, setCropQueueNames] = useState<string[]>([]);
	const [cropModalOpen, setCropModalOpen] = useState(false);
	const [currentCropSrc, setCurrentCropSrc] = useState("");

	const processNextCrop = useCallback(() => {
		setCropQueue((prev) => {
			if (prev.length === 0) return prev;
			const [nextSrc, ...rest] = prev;
			setCurrentCropSrc(nextSrc);
			setCropModalOpen(true);
			setCropQueueNames((names) => {
				const [, ...restNames] = names;
				return restNames;
			});
			return rest;
		});
	}, []);

	const handleCropComplete = useCallback(
		(blob: Blob) => {
			const fileName =
				cropQueueNames[0] || `cropped_image_${Date.now()}.jpg`;
			const file = new File([blob], fileName, { type: "image/jpeg" });
			setPostImageFiles((prev) => [...prev, file]);
			if (currentCropSrc) URL.revokeObjectURL(currentCropSrc);
			setCropModalOpen(false);
			setTimeout(() => processNextCrop(), 100);
		},
		[cropQueueNames, processNextCrop, currentCropSrc],
	);

	useEffect(() => {
		if (
			cropQueue.length === 0 &&
			!cropModalOpen &&
			postImageFiles.length > 0
		) {
			const previews = postImageFiles.map((f) => URL.createObjectURL(f));
			setPostImagePreviews(previews);
		}
	}, [cropQueue, cropModalOpen, postImageFiles]);

	const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

	const clearFieldError = (field: string) => {
		setFieldErrors((prev) => {
			if (!prev[field]) return prev;
			const next = { ...prev };
			delete next[field];
			return next;
		});
	};

	// Close on Escape key + focus trap
	const modalRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!isOpen) return;
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				onClose();
				return;
			}
			if (e.key === "Tab") {
				const modal = modalRef.current;
				if (!modal) return;
				const focusable = modal.querySelectorAll<HTMLElement>(
					'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
				);
				if (focusable.length === 0) return;
				const first = focusable[0];
				const last = focusable[focusable.length - 1];
				if (e.shiftKey) {
					if (document.activeElement === first) {
						e.preventDefault();
						last.focus();
					}
				} else {
					if (document.activeElement === last) {
						e.preventDefault();
						first.focus();
					}
				}
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		// Focus first focusable element on open
		requestAnimationFrame(() => {
			const firstFocusable = modalRef.current?.querySelector<HTMLElement>(
				'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
			);
			firstFocusable?.focus();
		});
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [isOpen, onClose]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		const errors = validatePost({
			title,
			content,
			hasImages: postImageFiles.length > 0,
		});
		if (Object.keys(errors).length > 0) {
			setFieldErrors(errors);
			return;
		}
		setFieldErrors({});
		setSubmittingPost(true);

		try {
			const formData = new FormData();
			formData.append("title", title);
			formData.append("content", content);
			postImageFiles.forEach((file) => {
				formData.append("images", file);
			});

			const res = await apiFetch("/api/posts", {
				method: "POST",
				body: formData,
			});

			if (!res.ok) {
				const data = await res.json();
				throw new Error(data.message || "Failed to create post");
			}

			// Revoke previous preview URLs to prevent memory leaks
			postImagePreviews.forEach((url) => URL.revokeObjectURL(url));
			setTitle("");
			setContent("");
			setPostImageFiles([]);
			setPostImagePreviews([]);
			onPostCreated();
		} catch (err: any) {
			logger.error(err);
			window.dispatchEvent(
				new CustomEvent("showToast", {
					detail: {
						message:
							err.message ||
							"Failed to create post. Please try again.",
						type: "error",
					},
				}),
			);
		} finally {
			setSubmittingPost(false);
		}
	};

	if (!isOpen) return null;

	return (
		<AnimatePresence>
			<div
				key="post-modal-overlay"
				ref={modalRef}
				className="fixed inset-0 z-[300] flex items-center justify-center p-2 sm:p-4">
				<motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					onClick={onClose}
					className="absolute inset-0 bg-black/60 backdrop-blur-sm"
				/>
				<motion.div
					initial={{ opacity: 0, scale: 0.95, y: 20 }}
					animate={{ opacity: 1, scale: 1, y: 0 }}
					exit={{ opacity: 0, scale: 0.95, y: 20 }}
					className="relative w-full max-w-lg bg-zinc-950/45 backdrop-blur-xl rounded-2xl shadow-xl overflow-hidden border border-zinc-800/50 max-h-[95vh] overflow-y-auto">
					<div className="flex items-center justify-between px-3 py-3 border-b border-zinc-100 dark:border-zinc-900 sm:px-4">
						<h2 className="text-base font-bold text-black dark:text-white">
							Create Post
						</h2>
						<button
							onClick={onClose}
							className="p-2 bg-zinc-100 dark:bg-zinc-900 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-500">
							<X className="w-5 h-5" />
						</button>
					</div>
					<div className="p-3 sm:p-4">
						<form
							onSubmit={handleSubmit}
							noValidate
							className="space-y-4">
							<div className="flex items-center gap-2">
								<input
									type="text"
									maxLength={500}
									placeholder="Give your post a title... (optional)"
									value={title}
									onChange={(e) => {
										setTitle(e.target.value);
										clearFieldError("title");
									}}
									autoFocus
									className="flex-1 bg-transparent text-[12px] md:text-sm font-bold text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-600 outline-none"
								/>
								<CharCounter current={title.length} max={500} />
							</div>
							<ValidationMessage message={fieldErrors.title} />
							<textarea
								rows={4}
								placeholder="What's on your mind today? Share any interesting thought or story..."
								value={content}
								onChange={(e) => {
									setContent(e.target.value);
									clearFieldError("content");
								}}
								maxLength={5000}
								className="w-full resize-none bg-transparent text-[12px] md:text-sm text-slate-800 dark:text-zinc-300 placeholder-slate-500 dark:placeholder-zinc-500 outline-none"
							/>
							<div className="flex items-center justify-end mt-1">
								<CharCounter
									current={content.length}
									max={5000}
								/>
							</div>
							<ValidationMessage message={fieldErrors.content} />

							{/* Multiple image previews */}
							{postImagePreviews.length > 0 && (
								<div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
									{postImagePreviews.map((preview, idx) => (
										<div
											key={idx}
											className="relative shrink-0 overflow-hidden rounded-xl border border-zinc-800 w-20 h-20">
											<img
												loading="lazy"
												src={preview}
												alt=""
												className="w-full h-full object-cover"
											/>
											<button
												type="button"
												onClick={() => {
													setPostImageFiles((prev) =>
														prev.filter(
															(_, i) => i !== idx,
														),
													);
													setPostImagePreviews(
														(prev) =>
															prev.filter(
																(_, i) =>
																	i !== idx,
															),
													);
												}}
												className="absolute top-1.5 right-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-black/70 text-white hover:bg-black z-20">
												<X className="h-2.5 w-2.5" />
											</button>
										</div>
									))}
								</div>
							)}

							<div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-zinc-900">
								<div className="relative">
									<input
										type="file"
										accept="image/*"
										multiple
										disabled={postImageFiles.length >= 5}
										onChange={(e) => {
											const files = Array.from(
												e.target.files || [],
											);
											const remaining =
												5 - postImageFiles.length;
											const toAdd = files.slice(
												0,
												remaining,
											);
											// GIFs bypass cropping — add directly with previews
											const gifFiles = toAdd.filter(
												(f) => f.type === "image/gif",
											);
											const cropFiles = toAdd.filter(
												(f) => f.type !== "image/gif",
											);
											if (gifFiles.length > 0) {
												setPostImageFiles((prev) => [
													...prev,
													...gifFiles,
												]);
												const gifPreviews =
													gifFiles.map((f) =>
														URL.createObjectURL(f),
													);
												setPostImagePreviews((prev) => [
													...prev,
													...gifPreviews,
												]);
											}
											const newUrls = cropFiles.map((f) =>
												URL.createObjectURL(f),
											);
											const newNames = cropFiles.map(
												(f) => f.name,
											);
											setCropQueue((prev) => [
												...prev,
												...newUrls,
											]);
											setCropQueueNames((prev) => [
												...prev,
												...newNames,
											]);
											if (
												cropQueue.length === 0 &&
												!cropModalOpen &&
												newUrls.length > 0
											) {
												setCurrentCropSrc(newUrls[0]);
												setCropModalOpen(true);
												setCropQueue((prev) => {
													const [, ...rest] = prev;
													return rest;
												});
											}
											e.target.value = "";
										}}
										className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
									/>
									<button
										type="button"
										className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-650 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 cursor-pointer pointer-events-none">
										<Image className="h-5 w-5" />
									</button>
									{postImageFiles.length > 0 && (
										<span className="text-[9px] text-zinc-500 ml-1">
											{postImageFiles.length}/5
										</span>
									)}
								</div>
								<button
									type="submit"
									disabled={submittingPost}
									className="rounded-full bg-white text-black hover:bg-zinc-200 border border-white/20 px-6 py-2 text-[12px] md:text-sm font-bold disabled:opacity-50 transition-all font-sans cursor-pointer">
									{submittingPost ? (
										<Loader2 className="h-4 w-4 animate-spin" />
									) : (
										"Post"
									)}
								</button>
							</div>
						</form>
					</div>
				</motion.div>
			</div>
			<ImageCropModal
				isOpen={cropModalOpen}
				onClose={() => {
					setCropModalOpen(false);
					setCropQueue([]);
					setCropQueueNames([]);
					cropQueue.forEach((url) => URL.revokeObjectURL(url));
					if (currentCropSrc) URL.revokeObjectURL(currentCropSrc);
					setCurrentCropSrc("");
				}}
				imageSrc={currentCropSrc}
				aspectRatio={undefined}
				title="Crop Photo"
				onCropComplete={handleCropComplete}
			/>
		</AnimatePresence>
	);
}
