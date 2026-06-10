import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Image, Loader2 } from "lucide-react";
import ImageCropModal from "./ImageCropModal";
import { apiFetch } from "../utils/api";
import { logger } from "../utils/logger";
import { validatePost } from "../utils/validation";
import ValidationMessage from "./ValidationMessage";
import CharCounter from "./CharCounter";

interface PostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPostCreated: () => void;
}

export default function PostModal({ isOpen, onClose, onPostCreated }: PostModalProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [postImageFile, setPostImageFile] = useState<File | null>(null);
  const [postImagePreview, setPostImagePreview] = useState("");
  const [submittingPost, setSubmittingPost] = useState(false);

  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState("");

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
      const firstFocusable = modalRef.current?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      firstFocusable?.focus();
    });
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validatePost({ title, content });
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
      if (postImageFile) {
        formData.append("image", postImageFile);
      }

      const res = await apiFetch("/api/posts", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to create post");
      }

      // Revoke previous preview URL to prevent memory leaks
      if (postImagePreview) URL.revokeObjectURL(postImagePreview);
      setTitle("");
      setContent("");
      setPostImageFile(null);
      setPostImagePreview("");
      onPostCreated();
    } catch (err: any) {
      logger.error(err);
      window.dispatchEvent(
        new CustomEvent("showToast", {
          detail: {
            message: err.message || "Failed to create post. Please try again.",
            type: "error",
          },
        })
      );
    } finally {
      setSubmittingPost(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div key="post-modal-overlay" ref={modalRef} className="fixed inset-0 z-[100] flex items-center justify-center p-4">
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
          className="relative w-full max-w-lg bg-zinc-950/45 backdrop-blur-xl rounded-2xl shadow-xl overflow-hidden border border-zinc-800/50"
        >
          <div className="flex items-center justify-between p-4 border-b border-zinc-100 dark:border-zinc-900">
            <h2 className="text-lg font-bold text-black dark:text-white">Create Post</h2>
            <button onClick={onClose} className="p-2 bg-zinc-100 dark:bg-zinc-900 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-500">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-4">
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  maxLength={500}
                  placeholder="Give your post a title..."
                  value={title}
                  onChange={(e) => { setTitle(e.target.value); clearFieldError("title"); }}
                  autoFocus
                  className="flex-1 bg-transparent text-xl font-bold text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-600 outline-none"
                />
                <CharCounter current={title.length} max={500} />
              </div>
              <ValidationMessage message={fieldErrors.title} />
              <textarea
                rows={4}
                placeholder="What's on your mind today? Share any interesting thought or story..."
                value={content}
                onChange={(e) => { setContent(e.target.value); clearFieldError("content"); }}
                maxLength={5000}
                className="w-full resize-none bg-transparent text-sm text-slate-800 dark:text-zinc-300 placeholder-slate-500 dark:placeholder-zinc-500 outline-none"
              />
              <div className="flex items-center justify-end mt-1">
                <CharCounter current={content.length} max={5000} />
              </div>
              <ValidationMessage message={fieldErrors.content} />
              {postImagePreview && (
                <div className="relative mt-3 rounded-xl border border-zinc-800 overflow-hidden">
                  <img loading="lazy" src={postImagePreview} alt="" className="w-full h-auto max-h-125 object-cover" />
                  <button
                    type="button"
                    onClick={() => {
                      setPostImageFile(null);
                      setPostImagePreview("");
                    }}
                    className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md hover:bg-black/80 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-zinc-900">
                <div className="relative">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        // Revoke previous crop image URL to prevent leaks
                        if (cropImageSrc) URL.revokeObjectURL(cropImageSrc);
                        setCropImageSrc(URL.createObjectURL(file));
                        setCropModalOpen(true);
                      }
                      e.target.value = '';
                    }}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  <button
                    type="button"
                    className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-650 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 cursor-pointer pointer-events-none"
                  >
                    <Image className="h-5 w-5" />
                  </button>
                </div>
                <button
                  type="submit"
                  disabled={!title || !content || submittingPost}
                  className="rounded-full bg-white text-black hover:bg-zinc-200 border border-white/20 px-6 py-2 text-sm font-bold disabled:opacity-50 transition-all font-sans cursor-pointer"
                >
                  {submittingPost ? <Loader2 className="h-4 w-4 animate-spin" /> : "Post"}
                </button>
              </div>
            </form>
          </div>
        </motion.div>
      </div>

      <ImageCropModal
        key="post-crop-modal"
        isOpen={cropModalOpen}
        onClose={() => setCropModalOpen(false)}
        imageSrc={cropImageSrc}
        aspectRatio={undefined}
        title="Crop Photo Layout"
        onCropComplete={(blob) => {
          const file = new File([blob], `post_cropped.jpg`, { type: "image/jpeg" });
          setPostImageFile(file);
          setPostImagePreview(URL.createObjectURL(blob));
        }}
      />
    </AnimatePresence>
  );
}
