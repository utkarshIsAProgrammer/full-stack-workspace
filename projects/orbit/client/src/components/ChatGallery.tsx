import React from "react";
import { Music, FileText, X } from "lucide-react";

interface ChatGalleryProps {
	attachmentPreviews: string[];
	attachments: File[];
	removeAttachment: (index: number) => void;
}

export default React.memo(function ChatGallery({
	attachmentPreviews,
	attachments,
	removeAttachment,
}: ChatGalleryProps) {
	if (attachmentPreviews.length === 0) return null;

	return (
		<div className="flex gap-2 mb-3 bg-zinc-900/50 p-2.5 rounded-2xl border border-zinc-800 max-w-sm">
			{attachmentPreviews.map((url, idx) => {
				const file = attachments[idx];
				const isImage = file && file.type.startsWith("image/");
				const isVideo = file && file.type.startsWith("video/");
				const isAudio = file && file.type.startsWith("audio/");

				return (
					<div
						key={idx}
						className="relative h-14 w-14 rounded-lg overflow-hidden border border-zinc-800 shrink-0">
						{isImage ? (
							<img
								loading="lazy"
								src={url}
								alt="Attachment preview"
								className="h-full w-full object-cover"
							/>
						) : isVideo ? (
							<video
								src={url}
								className="h-full w-full object-cover bg-black"
								muted
								preload="metadata"
							/>
						) : isAudio ? (
							<div className="h-full w-full flex items-center justify-center bg-zinc-900 text-zinc-400">
								<Music className="h-5 w-5" />
							</div>
						) : (
							<div className="h-full w-full flex items-center justify-center bg-zinc-900 text-zinc-400">
								<FileText className="h-5 w-5" />
							</div>
						)}
						<button
							type="button"
							onClick={() => removeAttachment(idx)}
							className="absolute top-1 right-1 h-4 w-4 bg-zinc-950/80 hover:bg-zinc-900 text-zinc-300 hover:text-white rounded-full flex items-center justify-center scale-90 z-20 cursor-pointer">
							<X className="h-2.5 w-2.5" />
						</button>
					</div>
				);
			})}
		</div>
	);
});
