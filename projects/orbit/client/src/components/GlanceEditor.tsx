import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { X, Check, Loader2, Smartphone, Globe, Lock } from "lucide-react";
import { logger } from "../utils/logger";

type GlanceVisibility = "public" | "closeFriends";

interface GlanceEditorProps {
	file: File;
	onClose: () => void;
	onApply: (blob: Blob, visibility: GlanceVisibility) => void;
}

const GLANCE_ASPECT = 9 / 16;

/**
 * Pre-publish glance editor.
 * - Renders the image inside a strict 9:16 glance frame so users see exactly
 *   how it will look (whatsapp / instagram story style).
 * - Cropping is fully automatic: the image is center-cropped to 9:16 and
 *   downscaled before upload. No drag / zoom / rotate — publish is instant.
 * - Emits the final cropped image as a Blob via onApply.
 */
export default function GlanceEditor({ file, onClose, onApply }: GlanceEditorProps) {
	const [imageSrc, setImageSrc] = useState<string>("");
	const [applying, setApplying] = useState(false);
	// Public by default — tap the toggle to make it close-friends only.
	const [visibility, setVisibility] = useState<GlanceVisibility>("public");
	const modalRef = useRef<HTMLDivElement>(null);
	const isVideo = file.type.startsWith("video/");

	// Create object URL for the selected file
	useEffect(() => {
		const url = URL.createObjectURL(file);
		setImageSrc(url);
		return () => URL.revokeObjectURL(url);
	}, [file]);

	// Escape key to close + focus trap (same pattern as ImageCropModal)
	useEffect(() => {
		if (!imageSrc) return;
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
		requestAnimationFrame(() => {
			const firstFocusable = modalRef.current?.querySelector<HTMLElement>(
				'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
			);
			firstFocusable?.focus();
		});
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [imageSrc, onClose]);

	const createImage = (url: string): Promise<HTMLImageElement> =>
		new Promise((resolve, reject) => {
			const image = new Image();
			image.addEventListener("load", () => resolve(image));
			image.addEventListener("error", (error) => reject(error));
			image.src = url;
		});

	const createCrop = async () => {
		if (!imageSrc) return;
		setApplying(true);

		// Videos pass through untouched — no client-side re-encode. The parent
		// uploads the original file with the chosen audience.
		if (isVideo) {
			onApply(file, visibility);
			return;
		}

		try {
			const image = await createImage(imageSrc);
			const canvas = document.createElement("canvas");
			const ctx = canvas.getContext("2d");
			if (!ctx) return;

			// Fixed centered 9:16 crop of the natural image — no user input.
			const imgW = image.naturalWidth;
			const imgH = image.naturalHeight;
			let cropW: number, cropH: number, cx: number, cy: number;
			if (imgW / imgH > GLANCE_ASPECT) {
				// Image is wider than 9:16 → crop the left/right edges
				cropH = imgH;
				cropW = imgH * GLANCE_ASPECT;
				cx = (imgW - cropW) / 2;
				cy = 0;
			} else {
				// Image is taller than 9:16 → crop the top/bottom
				cropW = imgW;
				cropH = imgW / GLANCE_ASPECT;
				cx = 0;
				cy = (imgH - cropH) / 2;
			}

			// Downscale before upload — the glance frame renders at ≤ ~400px
			// wide on screen, so 720×1280 is already 1.8× sharpness. This keeps
			// the upload tiny and publishing feels instant.
			const MAX_W = 720;
			const MAX_H = 1280;
			const scale = Math.min(1, MAX_W / cropW, MAX_H / cropH);
			const outW = Math.max(1, Math.round(cropW * scale));
			const outH = Math.max(1, Math.round(cropH * scale));

			canvas.width = outW;
			canvas.height = outH;
			ctx.drawImage(image, cx, cy, cropW, cropH, 0, 0, outW, outH);

			canvas.toBlob(
				(blob) => {						setApplying(false);
						if (blob) {
							onApply(blob, visibility);
						} else {
						logger.error("Glance editor: canvas.toBlob returned null");
					}
				},
				"image/jpeg",
				0.8,
			);
		} catch (e) {
			setApplying(false);
			logger.error("Glance editor: crop failed", e);
		}
	};

	return createPortal(
		<AnimatePresence>
			<motion.div
				ref={modalRef}
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				exit={{ opacity: 0 }}
				className="fixed inset-0 z-[400] flex items-center justify-center bg-black/90 backdrop-blur-md p-3 sm:p-6">
				<div className="relative flex h-full w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-zinc-950 border border-zinc-800 shadow-2xl">
					{/* Header */}
					<div className="flex items-center justify-between border-b border-zinc-800 bg-black p-4 relative z-10">
						<div className="text-left">
							<h3 className="text-base font-semibold text-white">
								Edit Glance
							</h3>
							<p className="text-[11px] text-zinc-500 font-bold">
								{isVideo
									? "Preview your glance — max 1 minute"
									: "Auto-framed 9:16 — publish instantly"}
							</p>
						</div>
						<button
							onClick={onClose}
							className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-900 text-zinc-500 hover:text-black dark:hover:text-white transition-colors cursor-pointer">
							<X className="h-4 w-4" />
						</button>
					</div>

					{/* Preview — fixed 9:16 frame, center-cropped exactly as it will publish */}
					<div className="relative flex-1 bg-black/90 flex items-center justify-center p-3 sm:p-4">
						<div
							className="relative h-full max-h-[62vh] w-auto overflow-hidden rounded-2xl border border-white/10 shadow-2xl"
							style={{ aspectRatio: "9 / 16" }}>
							{imageSrc &&
								(isVideo ? (
									<video
										src={imageSrc}
										controls
										autoPlay
										muted
										loop
										playsInline
										className="h-full w-full object-cover select-none"
									/>
								) : (
									<img
										src={imageSrc}
										alt="Glance preview"
										draggable={false}
										className="h-full w-full object-cover select-none pointer-events-none"
									/>
								))}
						</div>
					</div>

					{/* Glance format indicator — always a fixed 9:16 frame */}
					<div className="flex items-center gap-2 border-t border-zinc-800 bg-zinc-900/60 p-3 relative z-10">
						<span className="flex items-center gap-1.5 rounded-full bg-white text-black px-3 py-1.5 text-[11px] font-bold">
							<Smartphone className="h-3.5 w-3.5" />
							{isVideo ? "Video Glance" : "9:16 Glance"}
						</span>
					</div>

					{/* Controls Footer */}
					<div className="flex items-center justify-between gap-3 border-t border-zinc-800 bg-black p-4 sm:p-5 relative z-10">
						{/* Audience toggle — public by default, tap for close friends only */}
						<div className="flex items-center gap-1 rounded-full border border-zinc-800 bg-zinc-900/60 p-1">
							<button
								type="button"
								onClick={() => setVisibility("public")}
								className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold transition-all cursor-pointer ${
									visibility === "public"
										? "bg-white text-black"
										: "text-zinc-400 hover:text-white"
								}`}
							>
								<Globe className="h-3.5 w-3.5" />
								Public
							</button>
							<button
								type="button"
								onClick={() => setVisibility("closeFriends")}
								className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold transition-all cursor-pointer ${
									visibility === "closeFriends"
										? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40"
										: "text-zinc-400 hover:text-white"
								}`}
							>
								<Lock className="h-3.5 w-3.5" />
								Close friends
							</button>
						</div>
						<div className="flex items-center gap-3">
						<button
							type="button"
							onClick={onClose}
							className="rounded-full border border-zinc-700 px-5 py-2.5 text-[12px] font-bold text-zinc-300 hover:bg-zinc-900 transition-all cursor-pointer">
							Cancel
						</button>
						<button
							onClick={createCrop}
							disabled={applying}
							className="flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-2.5 text-[12px] md:text-sm font-bold text-black hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer">
							{applying ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : (
								<>
									<Check className="h-4 w-4" />
									Post Glance
								</>
							)}
						</button>
						</div>
					</div>
				</div>
			</motion.div>
		</AnimatePresence>,
		document.body,
	);
}
