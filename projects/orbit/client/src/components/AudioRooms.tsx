import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Mic, Plus, X, Users, Loader2, LogIn, LogOut } from "lucide-react";
import { apiFetch } from "../utils/api";
import { logger } from "../utils/logger";
import UserAvatar from "./UserAvatar";
import EmptyState from "./EmptyState";

interface AudioRoom {
	_id: string;
	title: string;
	description?: string;
	host: { _id: string; username: string; fullName: string; profilePic?: string };
	isLive: boolean;
	speakers: { _id: string; username: string }[];
	listeners: { _id: string; username: string }[];
	listenerCount: number;
	createdAt: string;
}

interface AudioRoomsProps {
	user: { _id: string };
}

export default function AudioRooms({ user }: AudioRoomsProps) {
	const [rooms, setRooms] = useState<AudioRoom[]>([]);
	const [loading, setLoading] = useState(true);
	const [showCreate, setShowCreate] = useState(false);
	const [title, setTitle] = useState("");
	const [description, setDescription] = useState("");
	const [creating, setCreating] = useState(false);

	const fetchRooms = async () => {
		try {
			setLoading(true);
			const res = await apiFetch("/api/audio-rooms/live");
			const data = await res.json();
			if (res.ok && data.success) {
				setRooms(data.rooms || []);
			}
		} catch (err) {
			logger.error("Failed to fetch audio rooms", err);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchRooms();
	}, []);

	const handleCreate = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!title.trim()) return;
		setCreating(true);
		try {
			const res = await apiFetch("/api/audio-rooms", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ title: title.trim(), description: description.trim() }),
			});
			const data = await res.json();
			if (res.ok && data.success) {
				setShowCreate(false);
				setTitle("");
				setDescription("");
				fetchRooms();
			}
		} catch (err) {
			logger.error("Failed to create room", err);
		} finally {
			setCreating(false);
		}
	};

	const handleJoin = async (roomId: string) => {
		try {
			await apiFetch(`/api/audio-rooms/${roomId}/join`, { method: "POST" });
			fetchRooms();
		} catch (err) {
			logger.error("Failed to join room", err);
		}
	};

	const handleLeave = async (roomId: string) => {
		try {
			await apiFetch(`/api/audio-rooms/${roomId}/leave`, { method: "POST" });
			fetchRooms();
		} catch (err) {
			logger.error("Failed to leave room", err);
		}
	};

	const isUserInRoom = (room: AudioRoom) => {
		return (
			room.host._id === user._id ||
			room.speakers.some((s) => s._id === user._id) ||
			room.listeners.some((l) => l._id === user._id)
		);
	};

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<h2 className="text-sm font-bold text-white flex items-center gap-2">
					<Mic className="h-4 w-4 text-orange-400" /> Live Audio Rooms
				</h2>
				<button
					onClick={() => setShowCreate(true)}
					className="rounded-full bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/30 px-3 py-1 text-[10px] font-bold text-orange-300 transition-all cursor-pointer flex items-center gap-1"
				>
					<Plus className="h-3 w-3" /> Create Room
				</button>
			</div>

			{loading ? (
				<div className="space-y-3">
					{[1, 2, 3].map((n) => (
						<div
							key={n}
							className="bg-zinc-900/60 border border-zinc-800/50 rounded-2xl p-4"
							style={{ '--shimmer-delay': `${(n - 1) * 0.12}s` } as React.CSSProperties}
						>
							<div className="flex items-start justify-between gap-3">
								<div className="flex-1 min-w-0 space-y-3">
									{/* Title row */}
									<div className="flex items-center gap-2">
										<div className="h-2 w-2 rounded-full shimmer-bg" />
										<div className="h-3.5 w-2/3 rounded shimmer-bg" />
									</div>
									{/* Description */}
									<div className="h-2.5 w-full rounded shimmer-bg" />
									<div className="h-2.5 w-1/2 rounded shimmer-bg" />
									{/* Host + listener count row */}
									<div className="flex items-center gap-3">
										<div className="flex items-center gap-1.5">
											<div className="h-6 w-6 rounded-full shimmer-bg" />
											<div className="h-2.5 w-16 rounded shimmer-bg" />
										</div>
										<div className="h-2.5 w-10 rounded shimmer-bg" />
									</div>
								</div>
								{/* Join button placeholder */}
								<div className="h-7 w-16 rounded-full shimmer-bg shrink-0" />
							</div>
						</div>
					))}
				</div>
			) : rooms.length === 0 ? (
				<EmptyState
					variant="search"
					title="No live rooms"
					description="Create one to start a conversation!"
				/>
			) : (
				<div className="space-y-3">
					{rooms.map((room) => (
						<motion.div
							key={room._id}
							initial={{ opacity: 0, y: 8 }}
							animate={{ opacity: 1, y: 0 }}
							className="bg-zinc-900/60 border border-zinc-800/50 rounded-2xl p-4"
						>
							<div className="flex items-start justify-between gap-3">
								<div className="flex-1 min-w-0">
									<div className="flex items-center gap-2">
										<span className="h-2 w-2 rounded-full bg-green-500 animate-pulse shrink-0" />
										<h3 className="text-sm font-bold text-white truncate">
											{room.title}
										</h3>
									</div>
									{room.description && (
										<p className="text-[11px] text-zinc-400 mt-1 line-clamp-2">
											{room.description}
										</p>
									)}
									<div className="flex items-center gap-3 mt-2">
										<div className="flex items-center gap-1.5">
											<UserAvatar
												src={room.host.profilePic}
												alt={room.host.fullName}
												className="h-6 w-6"
											/>
											<span className="text-[10px] text-zinc-500 font-medium">
												{room.host.fullName}
											</span>
										</div>
										<span className="text-[10px] text-zinc-600 flex items-center gap-1">
											<Users className="h-3 w-3" />{" "}
											{room.listenerCount || room.listeners.length}
										</span>
									</div>
								</div>
								<button
									onClick={() =>
										isUserInRoom(room)
											? handleLeave(room._id)
											: handleJoin(room._id)
									}
									className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
										isUserInRoom(room)
											? "bg-red-500/20 text-red-300 hover:bg-red-500/30 border border-red-500/30"
											: "bg-orange-500/20 text-orange-300 hover:bg-orange-500/30 border border-orange-500/30"
									}`}
								>
									{isUserInRoom(room) ? (
										<><LogOut className="h-3 w-3" /> Leave</>
									) : (
										<><LogIn className="h-3 w-3" /> Join</>
									)}
								</button>
							</div>
						</motion.div>
					))}
				</div>
			)}

			<AnimatePresence>
				{showCreate && (
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
					>
						<motion.div
							initial={{ scale: 0.95, y: 20 }}
							animate={{ scale: 1, y: 0 }}
							exit={{ scale: 0.95, y: 20 }}
							className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 w-full max-w-md"
						>
							<div className="flex items-center justify-between mb-4">
								<h3 className="text-sm font-bold text-white">Create Audio Room</h3>
								<button
									onClick={() => setShowCreate(false)}
									className="p-1 rounded-full hover:bg-zinc-800 transition-colors cursor-pointer"
								>
									<X className="h-4 w-4 text-zinc-400" />
								</button>
							</div>
							<form onSubmit={handleCreate} className="space-y-3">
								<input
									value={title}
									onChange={(e) => setTitle(e.target.value)}
									placeholder="Room title..."
									maxLength={100}
									className="w-full rounded-xl bg-zinc-800/50 border border-zinc-700/50 px-4 py-2.5 text-sm text-white placeholder-zinc-500 outline-none focus:border-orange-500/50 transition-colors"
								/>
								<textarea
									value={description}
									onChange={(e) => setDescription(e.target.value)}
									placeholder="Description (optional)"
									maxLength={500}
									rows={3}
									className="w-full rounded-xl bg-zinc-800/50 border border-zinc-700/50 px-4 py-2.5 text-sm text-white placeholder-zinc-500 outline-none focus:border-orange-500/50 transition-colors resize-none"
								/>
								<button
									type="submit"
									disabled={!title.trim() || creating}
									className="w-full rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed py-2.5 text-sm font-bold text-white transition-all cursor-pointer flex items-center justify-center gap-2"
								>
									{creating ? (
										<Loader2 className="h-4 w-4 animate-spin" />
									) : (
										"Create Room"
									)}
								</button>
							</form>
						</motion.div>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}
