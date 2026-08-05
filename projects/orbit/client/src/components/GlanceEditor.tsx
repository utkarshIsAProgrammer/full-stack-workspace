import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import Cropper from "react-easy-crop";
import { X, Check, Loader2, RotateCcw, ZoomIn, Smartphone, Crop } from "lucide-react";
import { logger } from "../utils/logger";

interface Point {
	x: number;
	y: number;
}
interface Area {
	width: number;
	height: number;
	x: number;
	y: number;
}
interface Size {
	width: number;
	height: number;
}

interface GlanceEditorProps {
	file: File;
	onClose: () => void;
	onApply: (blob: Blob) => void;
}

/**
 * Pre-publish glance editor.
 * - Renders the image inside a strict 9:16 story frame (like WhatsApp / Instagram
 *   reels & status) so users see exactly how it will look.
 * - Drag to reposition, zoom with the slider (or pinch on touch), rotate freely,
 *   and switch to "Free Crop" to resize the crop window from any side / corner.
 * - Emits the final cropped image as a Blob via onApply.
 */
export default function GlanceEditor({ file, onClose, onApply }: GlanceEditorProps) {
	const [imageSrc, setImageSrc] = useState<string>("");
	const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
	const [zoom, setZoom] = useState(1);
	const [rotation, setRotation] = useState(0);
	const [aspect, setAspect] = useState<number | undefined>(9 / 16);
	const [cropSize, setCropSize] = useState<Size>({ width: 320, height: 560 });
	const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
	const [applying, setApplying] = useState(false);
	const [freeCrop, setFreeCrop] = useState(false);
	const modalRef = useRef<HTMLDivElement>(null);
	const frameRef = useRef<HTMLDivElement>(null);

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

	const handleCropComplete = useCallback(
		(_croppedArea: Area, croppedAreaPixels: Area) => {
			setCroppedAreaPixels(croppedAreaPixels);
		},
		[],
	);

	const toggleFreeCrop = () => {
		const next = !freeCrop;
		setFreeCrop(next);
		setAspect(next ? undefined : 9 / 16);
		setCrop({ x: 0, y: 0 });
		setZoom(1);
		setRotation(0);
		if (next) {
			// Derive a crop window that always fits the preview frame
			const frame = frameRef.current;
			if (frame) {
				const rect = frame.getBoundingClientRect();
				const w = Math.max(80, Math.floor(rect.width * 0.7));
				const h = Math.max(140, Math.floor(rect.height * 0.7));
				setCropSize({ width: w, height: h });
			}
		} else {
			// When switching back to story mode, restore a 9:16 crop size
			setCropSize({ width: 320, height: 560 });
		}
	};

	const createImage = (url: string): Promise<HTMLImageElement> =>
		new Promise((resolve, reject) => {
			const image = new Image();
			image.addEventListener("load", () => resolve(image));
			image.addEventListener("error", (error) => reject(error));
			image.src = url;
		});

	const createCrop = async () => {
		if (!imageSrc || !croppedAreaPixels) return;
		setApplying(true);

		try {
			const image = await createImage(imageSrc);
			const canvas = document.createElement("canvas");
			const ctx = canvas.getContext("2d");
			if (!ctx) return;

			const { x, y, width, height } = croppedAreaPixels;
			canvas.width = width;
			canvas.height = height;

			// Handle translation for rotation if rotation is applied
			if (rotation) {
				ctx.translate(width / 2, height / 2);
				ctx.rotate((rotation * Math.PI) / 180);
				ctx.translate(-width / 2, -height / 2);
			}

			ctx.drawImage(image, x, y, width, height, 0, 0, width, height);

			canvas.toBlob(
				(blob) => {
					setApplying(false);
					if (blob) {
						onApply(blob);
					} else {
						logger.error("Glance editor: canvas.toBlob returned null");
					}
				},
				"image/jpeg",
				0.95,
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
								Drag to reposition · pinch/scroll to zoom · free crop from any side
							</p>
						</div>
						<button
							onClick={onClose}
							className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-900 text-zinc-500 hover:text-black dark:hover:text-white transition-colors cursor-pointer">
							<X className="h-4 w-4" />
						</button>
					</div>

					{/* Cropper — 9:16 story frame */}
					<div className="relative flex-1 bg-black/90 flex items-center justify-center p-3 sm:p-4">
						<div
							ref={frameRef}
							className="relative h-full max-h-[62vh] w-auto overflow-hidden rounded-2xl border border-white/10 shadow-2xl"
							style={{ aspectRatio: "9 / 16" }}>
							{imageSrc && (
								<Cropper
									image={imageSrc}
									crop={crop}
									zoom={zoom}
									rotation={rotation}
									aspect={aspect}
									cropSize={freeCrop ? cropSize : undefined}
									onCropChange={setCrop}
									onCropComplete={handleCropComplete}
									onZoomChange={setZoom}
									onRotationChange={setRotation}
									onCropSizeChange={freeCrop ? setCropSize : undefined}
									objectFit="contain"
								/>
							)}
						</div>
					</div>

					{/* Mode selector: story preset vs free crop */}
					<div className="flex items-center gap-2 border-t border-zinc-800 bg-zinc-900/60 p-3 relative z-10">
						<button
							type="button"
							onClick={() => {
								if (freeCrop) toggleFreeCrop();
							}}
							className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold transition-all cursor-pointer ${
								!freeCrop
									? "bg-white text-black"
									: "bg-zinc-900 border border-zinc-800 text-zinc-400 hover:bg-zinc-800"
							}`}>
							<Smartphone className="h-3.5 w-3.5" />
							9:16 Story
						</button>
						<button
							type="button"
							onClick={toggleFreeCrop}
							className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold transition-all cursor-pointer ${
								freeCrop
									? "bg-white text-black"
									: "bg-zinc-900 border border-zinc-800 text-zinc-400 hover:bg-zinc-800"
							}`}>
							<Crop className="h-3.5 w-3.5" />
							Free Crop
						</button>
					</div>

					{/* Controls Footer */}
					<div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-zinc-800 bg-black p-4 sm:p-5 relative z-10">
						<div className="flex flex-col w-full sm:w-1/2 gap-3">
							{/* Zoom slider */}
							<div className="flex items-center gap-3">
								<ZoomIn className="h-4 w-4 text-zinc-500 shrink-0" />
								<input
									type="range"
									value={zoom}
									min={1}
									max={3}
									step={0.05}
									aria-label="Zoom"
									onChange={(e) => setZoom(Number(e.target.value))}
									className="h-1.5 w-full appearance-none rounded-full bg-zinc-700 outline-none
                    [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
								/>
							</div>
							{/* Rotate slider */}
							<div className="flex items-center gap-3">
								<RotateCcw className="h-4 w-4 text-zinc-500 shrink-0" />
								<input
									type="range"
									value={rotation}
									min={0}
									max={360}
									step={1}
									aria-label="Rotate"
									onChange={(e) => setRotation(Number(e.target.value))}
									className="h-1.5 w-full appearance-none rounded-full bg-zinc-700 outline-none
                    [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
								/>
							</div>
						</div>

						<div className="flex items-center gap-3 w-full sm:w-auto">
							<button
								type="button"
								onClick={onClose}
								className="rounded-full border border-zinc-700 px-5 py-2.5 text-[12px] font-bold text-zinc-300 hover:bg-zinc-900 transition-all cursor-pointer">
								Cancel
							</button>
							<button
								onClick={createCrop}
								disabled={applying}
								className="flex flex-1 sm:flex-none items-center justify-center gap-2 rounded-xl bg-white px-6 py-2.5 text-[12px] md:text-sm font-bold text-black hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer">
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
