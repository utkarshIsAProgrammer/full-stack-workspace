import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Search, X, Loader2, Image as ImageIcon } from "lucide-react";

interface GifResult {
	id: string;
	url: string;
	preview: string;
	title: string;
}

interface GifPickerProps {
	isOpen: boolean;
	onClose: () => void;
	onSelect: (gifUrl: string) => void;
}

// Free GIF search using Tenor's public API with a demo key
// Users should replace with their own Tenor API key from https://developers.google.com/tenor
const TENOR_API_KEY = "AIzaSyC-TECH-KEY-HERE"; // Demo key - rate limited
const TENOR_CLIENT_KEY = "orbit_app";
const TENOR_SEARCH_URL = "https://tenor.googleapis.com/v2/search";

export default function GifPicker({ isOpen, onClose, onSelect }: GifPickerProps) {
	const [query, setQuery] = useState("");
	const [results, setResults] = useState<GifResult[]>([]);
	const [loading, setLoading] = useState(false);
	const [trending, setTrending] = useState<GifResult[]>([]);
	const searchTimeout = useRef<NodeJS.Timeout | null>(null);

	// Free alternative: use tenor public search (demo key may be rate limited)
	const searchGifs = useCallback(async (q: string) => {
		if (!q.trim()) {
			setResults([]);
			return;
		}
		setLoading(true);
		try {
			const res = await fetch(
				`${TENOR_SEARCH_URL}?q=${encodeURIComponent(q)}&key=${TENOR_API_KEY}&client_key=${TENOR_CLIENT_KEY}&limit=20&media_filter=tinygif`
			);
			const data = await res.json();
			if (data.results) {
				setResults(
					data.results.map((r: any) => ({
						id: r.id,
						url: r.media_formats?.tinygif?.url || "",
						preview: r.media_formats?.tinygif?.url || "",
						title: r.title || "",
					})).filter((r: GifResult) => r.url)
				);
			}
		} catch {
			// If Tenor API fails, show nothing
			setResults([]);
		} finally {
			setLoading(false);
		}
	}, []);

	const fetchTrending = useCallback(async () => {
		try {
			const res = await fetch(
				`https://tenor.googleapis.com/v2/trending?key=${TENOR_API_KEY}&client_key=${TENOR_CLIENT_KEY}&limit=20&media_filter=tinygif`
			);
			const data = await res.json();
			if (data.results) {
				setTrending(
					data.results.map((r: any) => ({
						id: r.id,
						url: r.media_formats?.tinygif?.url || "",
						preview: r.media_formats?.tinygif?.url || "",
						title: r.title || "",
					})).filter((r: GifResult) => r.url)
				);
			}
		} catch {
			setTrending([]);
		}
	}, []);

	useEffect(() => {
		if (isOpen) {
			fetchTrending();
		}
	}, [isOpen, fetchTrending]);

	const handleSearch = (val: string) => {
		setQuery(val);
		if (searchTimeout.current) clearTimeout(searchTimeout.current);
		searchTimeout.current = setTimeout(() => searchGifs(val), 400);
	};

	const handleSelect = (gif: GifResult) => {
		onSelect(gif.url);
		onClose();
	};

	const displayGifs = query.trim() ? results : trending;

	return (
		<AnimatePresence>
			{isOpen && (
				<motion.div
					initial={{ opacity: 0, scale: 0.95, y: 10 }}
					animate={{ opacity: 1, scale: 1, y: 0 }}
					exit={{ opacity: 0, scale: 0.95, y: 10 }}
					className="absolute bottom-16 left-0 right-0 mx-auto w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden z-40"
				>
					{/* Header */}
					<div className="flex items-center justify-between px-3 py-2.5 border-b border-zinc-800">
						<div className="flex items-center gap-2 flex-1">
							<ImageIcon className="h-4 w-4 text-purple-400 shrink-0" />
							<div className="relative flex-1">
								<Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
								<input
									value={query}
									onChange={(e) => handleSearch(e.target.value)}
									placeholder="Search GIFs..."
									className="w-full rounded-lg bg-zinc-800 pl-8 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 outline-none"
								/>
							</div>
						</div>
						<button
							onClick={onClose}
							className="p-1 rounded-full hover:bg-zinc-800 transition-colors ml-2 cursor-pointer"
						>
							<X className="h-3.5 w-3.5 text-zinc-400" />
						</button>
					</div>

					{/* Grid */}
					<div className="overflow-y-auto max-h-72 p-2">
						{loading ? (
							<div className="flex items-center justify-center py-8">
								<Loader2 className="h-5 w-5 text-zinc-500 animate-spin" />
							</div>
						) : displayGifs.length === 0 ? (
							<div className="text-center py-8">
								<p className="text-xs text-zinc-500">
									{query.trim() ? "No GIFs found" : "No trending GIFs available"}
								</p>
							</div>
						) : (
							<div className="grid grid-cols-2 gap-1.5">
								{displayGifs.map((gif) => (
									<button
										key={gif.id}
										onClick={() => handleSelect(gif)} type="button"
										className="rounded-lg overflow-hidden aspect-video bg-zinc-800 hover:ring-2 ring-purple-500/50 transition-all cursor-pointer"
									>
										<img
											src={gif.preview}
											alt={gif.title || "GIF"}
											loading="lazy"
											className="w-full h-full object-cover"
										/>
									</button>
								))}
							</div>
						)}
					</div>
				</motion.div>
			)}
		</AnimatePresence>
	);
}
