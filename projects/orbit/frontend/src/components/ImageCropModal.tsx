import React, { useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import { motion, AnimatePresence } from "motion/react";
import { Check, X } from "lucide-react";
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

interface ImageCropModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageSrc: string;
  aspectRatio?: number;
  onCropComplete: (croppedImageBlob: Blob) => void;
  title?: string;
  key?: React.Key;
}

export default function ImageCropModal({
  isOpen,
  onClose,
  imageSrc,
  aspectRatio,
  onCropComplete,
  title = "Crop Photo Layout",
}: ImageCropModalProps) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [aspect, setAspect] = useState<number | undefined>(aspectRatio);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  // Escape key + focus trap
  const cropModalRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "Tab") {
        const modal = cropModalRef.current;
        if (!modal) return;
        const focusable = modal.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
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
      const firstFocusable = cropModalRef.current?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      firstFocusable?.focus();
    });
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Keep aspect local state in sync when prop changes
  React.useEffect(() => {
    setAspect(aspectRatio);
    setZoom(1);
    setRotation(0);
    setCrop({ x: 0, y: 0 });
  }, [aspectRatio, imageSrc]);

  const handleCropComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const createCrop = async () => {
    if (!imageSrc || !croppedAreaPixels) return;

    try {
      const image = await createImage(imageSrc);
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      if (!ctx) return;

      // Ensure cropped dimensions are integers
      const { x, y, width, height } = croppedAreaPixels;
      canvas.width = width;
      canvas.height = height;

      // Handle translation for rotation if rotation is applied
      if (rotation) {
        ctx.translate(width / 2, height / 2);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.translate(-width / 2, -height / 2);
      }

      ctx.drawImage(
        image,
        x,
        y,
        width,
        height,
        0,
        0,
        width,
        height
      );

      canvas.toBlob((blob) => {
        if (blob) {
          onCropComplete(blob);
          onClose();
        }
      }, "image/jpeg", 0.95);
    } catch (e) {
      logger.error("Crop failed", e);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        ref={cropModalRef}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-200 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 sm:p-6"
      >
        <div className="relative flex h-full w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-zinc-950 border border-zinc-800 shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-800 bg-black p-4 relative z-10">
            <div className="text-left">
              <h3 className="font-sans text-sm font-black text-black dark:text-white uppercase tracking-wider">{title}</h3>
              <p className="text-[10px] text-zinc-500 font-bold">Drag to reposition, pinch/scroll to zoom</p>
            </div>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-900 text-zinc-500 hover:text-black dark:hover:text-white transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Cropper Container */}
          <div className="relative flex-1 bg-zinc-50 dark:bg-black/80">
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={aspect}
              onCropChange={setCrop}
              onCropComplete={handleCropComplete}
              onZoomChange={setZoom}
              onRotationChange={setRotation}
              onMediaLoaded={(_mediaSize) => {
                // aspect ratio is controlled by preset buttons
              }}
              objectFit="contain"
            />
          </div>

          {/* Dimension Selector Bar */}
          <div className="flex flex-wrap items-center gap-2 border-t border-zinc-800 bg-zinc-900/60 p-3 relative z-10 justify-start">
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mr-2">Dimensions:</span>

            <button
              type="button"
              onClick={() => setAspect(1)}
              className={`px-3 py-1 rounded-full text-xs font-bold tracking-tight transition cursor-pointer ${aspect === 1
                  ? "bg-black text-white dark:bg-white dark:text-black"
                  : "bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-800"
                }`}
            >
              1:1 Square
            </button>
            <button
              type="button"
              onClick={() => setAspect(4 / 5)}
              className={`px-3 py-1 rounded-full text-xs font-bold tracking-tight transition cursor-pointer ${aspect === 4 / 5
                  ? "bg-black text-white dark:bg-white dark:text-black"
                  : "bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-800"
                }`}
            >
              4:5 Post (X Style)
            </button>
            <button
              type="button"
              onClick={() => setAspect(16 / 9)}
              className={`px-3 py-1 rounded-full text-xs font-bold tracking-tight transition cursor-pointer ${aspect === 16 / 9
                  ? "bg-black text-white dark:bg-white dark:text-black"
                  : "bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-800"
                }`}
            >
              16:9 Landscape
            </button>

          </div>

          {/* Controls Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-zinc-800 bg-black p-4 sm:p-6 relative z-10">
            <div className="flex flex-col w-full sm:w-1/2 gap-3">
              {/* Zoom slider */}
              <div className="flex items-center gap-4">
                <span className="text-xs font-semibold text-zinc-500 w-12 text-left">Zoom</span>
                <input
                  type="range"
                  value={zoom}
                  min={1}
                  max={3}
                  step={0.05}
                  aria-label="Zoom"
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="h-1.5 w-full appearance-none rounded-full bg-zinc-200 dark:bg-zinc-700 outline-none
                  [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-black dark:[&::-webkit-slider-thumb]:bg-white"
                />
              </div>
              {/* Rotate slider */}
              <div className="flex items-center gap-4">
                <span className="text-xs font-semibold text-zinc-500 w-12 text-left">Rotate</span>
                <input
                  type="range"
                  value={rotation}
                  min={0}
                  max={360}
                  step={1}
                  aria-label="Rotate"
                  onChange={(e) => setRotation(Number(e.target.value))}
                  className="h-1.5 w-full appearance-none rounded-full bg-zinc-200 dark:bg-zinc-700 outline-none
                  [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-black dark:[&::-webkit-slider-thumb]:bg-white"
                />
              </div>
            </div>
            <button
              onClick={createCrop}
              className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-black dark:bg-white px-6 py-3 text-sm font-bold text-white dark:text-black hover:scale-105 transition-transform cursor-pointer"
            >
              Apply Crop <Check className="h-4 w-4" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (error) => reject(error));
    image.src = url;
  });
