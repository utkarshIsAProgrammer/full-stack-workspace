import { useState, useEffect, useRef, useCallback } from "react";
import {
	LiveKitRoom,
	GridLayout,
	ParticipantTile,
	useTracks,
	useLocalParticipant,
	RoomAudioRenderer,
} from "@livekit/components-react";
import { Track, type LocalParticipant } from "livekit-client";
import { motion } from "motion/react";
import { Mic, MicOff, Video, VideoOff, PhoneOff } from "lucide-react";

interface GroupCallFloorProps {
	livekitUrl: string;
	token: string;
	roomName: string;
	callType?: "audio" | "video";
	onLeave: () => void;
}

function CallParticipants() {
	const tracks = useTracks(
		[Track.Source.Camera, Track.Source.Microphone],
		{ onlySubscribed: false },
	);

	return (
		<GridLayout
			tracks={tracks}
			className="w-full h-full"
		>
			<ParticipantTile className="rounded-2xl overflow-hidden border border-zinc-800/60 bg-zinc-900/80" />
		</GridLayout>
	);
}

/**
 * Controls live inside <LiveKitRoom /> so useLocalParticipant() has access to
 * the room context. Mute/camera toggles call setMicrophoneEnabled /
 * setCameraEnabled directly (the audio/video props on LiveKitRoom are only
 * read at connect time and don't reliably toggle after that).
 */
function CallControls({
	callType,
	onLeave,
}: {
	callType: "audio" | "video";
	onLeave: () => void;
}) {
	const { localParticipant } = useLocalParticipant();
	const [isMuted, setIsMuted] = useState(false);
	const [isVideoOff, setIsVideoOff] = useState(callType !== "video");

	const toggleMute = () => {
		const next = !isMuted;
		setIsMuted(next);
		(localParticipant as LocalParticipant | undefined)?.setMicrophoneEnabled(!next);
	};

	const toggleVideo = () => {
		const next = !isVideoOff;
		setIsVideoOff(next);
		(localParticipant as LocalParticipant | undefined)?.setCameraEnabled(!next);
	};

	return (
		<div className="relative z-10 flex items-center justify-center gap-4 py-4 px-4 border-t border-zinc-800/50 shrink-0">
			{/* Mute toggle */}
			<button
				onClick={toggleMute}
				className={`h-12 w-12 rounded-2xl flex items-center justify-center transition-all cursor-pointer backdrop-blur-md ${
					isMuted
						? "bg-red-500/15 text-red-400 border border-red-500/25"
						: "bg-zinc-800/90 text-zinc-200 hover:bg-zinc-700/90 border border-zinc-700/50"
				}`}
				title={isMuted ? "Unmute" : "Mute"}
				aria-label={isMuted ? "Unmute microphone" : "Mute microphone"}
			>
				{isMuted ? (
					<MicOff className="h-5 w-5" />
				) : (
					<Mic className="h-5 w-5" />
				)}
			</button>

			{/* Video toggle (audio-only calls never start the camera) */}
			{callType === "video" && (
				<button
					onClick={toggleVideo}
					className={`h-12 w-12 rounded-2xl flex items-center justify-center transition-all cursor-pointer backdrop-blur-md ${
						isVideoOff
							? "bg-red-500/15 text-red-400 border border-red-500/25"
							: "bg-zinc-800/90 text-zinc-200 hover:bg-zinc-700/90 border border-zinc-700/50"
					}`}
					title={isVideoOff ? "Turn on camera" : "Turn off camera"}
					aria-label={isVideoOff ? "Enable camera" : "Disable camera"}
				>
					{isVideoOff ? (
						<VideoOff className="h-5 w-5" />
					) : (
						<Video className="h-5 w-5" />
					)}
				</button>
			)}

			{/* Leave call */}
			<button
				onClick={onLeave}
				className="h-12 w-12 rounded-2xl bg-red-500/90 text-white hover:bg-red-500 flex items-center justify-center transition-all cursor-pointer shadow-lg shadow-red-500/25 border border-red-400/30"
				title="Leave call"
				aria-label="Leave call"
			>
				<PhoneOff className="h-5 w-5" />
			</button>
		</div>
	);
}

export default function GroupCallFloor({
	livekitUrl,
	token,
	roomName,
	callType = "video",
	onLeave,
}: GroupCallFloorProps) {
	const [connectionState, setConnectionState] = useState<
		"connecting" | "connected" | "disconnected"
	>("connecting");
	const [callDuration, setCallDuration] = useState(0);
	const durationTimerRef = useRef<NodeJS.Timeout | null>(null);

	// Track connection state and start duration timer when connected
	const handleConnected = useCallback(() => {
		// Clear the "connecting/reconnecting" overlay once LiveKit connects
		setConnectionState("connected");
		setCallDuration(0);
		if (durationTimerRef.current) {
			clearInterval(durationTimerRef.current);
		}
		durationTimerRef.current = setInterval(() => {
			setCallDuration((prev) => prev + 1);
		}, 1000);
	}, []);

	const handleDisconnected = useCallback(() => {
		setConnectionState("disconnected");
		if (durationTimerRef.current) {
			clearInterval(durationTimerRef.current);
			durationTimerRef.current = null;
		}
	}, []);

	useEffect(() => {
		return () => {
			if (durationTimerRef.current) {
				clearInterval(durationTimerRef.current);
				durationTimerRef.current = null;
			}
		};
	}, []);

	const formatDuration = (s: number) => {
		const m = Math.floor(s / 60);
		const sec = s % 60;
		return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
	};

	return (
		<motion.div
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			exit={{ opacity: 0 }}
			className="fixed inset-0 z-[340] flex flex-col bg-zinc-950/95 backdrop-blur-2xl"
		>
			{/* Edge-light sheen */}
			<div className="absolute inset-x-0 top-0 h-[1.5px] bg-linear-to-r from-transparent via-white/30 to-transparent pointer-events-none z-20" />
			<div className="absolute inset-x-0 bottom-0 h-[1.5px] bg-linear-to-r from-transparent via-white/15 to-transparent pointer-events-none z-20" />

			{/* Connecting overlay */}
			{connectionState === "connecting" && (
				<div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-zinc-950/90">
					<div className="flex items-center gap-3 mb-4">
						<span className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
						<span className="text-sm font-bold text-zinc-300 uppercase tracking-widest">
							Connecting to group call...
						</span>
					</div>
					<p className="text-[11px] text-zinc-500 font-mono">
						Room: {roomName}
					</p>
				</div>
			)}

			{/* Reconnecting overlay */}
			{connectionState === "disconnected" && (
				<div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-zinc-950/90">
					<div className="flex items-center gap-3 mb-4">
						<span className="h-3 w-3 rounded-full bg-amber-400 animate-pulse" />
						<span className="text-sm font-bold text-amber-300 uppercase tracking-widest">
							Connection lost — reconnecting...
						</span>
					</div>
					<p className="text-[11px] text-zinc-500 font-mono">
						Room: {roomName}
					</p>
				</div>
			)}

			{/* Header */}
			<div className="relative z-10 flex items-center justify-between px-4 py-3 border-b border-zinc-800/50 shrink-0">
				<div className="flex items-center gap-3">
					<div className="flex items-center gap-2">
						<span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
						<span className="text-xs font-black text-zinc-300 uppercase tracking-widest">
							{callType === "video" ? "Group Video Call" : "Group Audio Call"}
						</span>
					</div>
				</div>
				<div className="flex items-center gap-3">
					<span className="text-[11px] font-bold text-zinc-400 font-mono">
						{connectionState === "connected"
							? formatDuration(callDuration)
							: "00:00"}
					</span>
					<button
						onClick={onLeave}
						className="flex h-7 px-2.5 items-center gap-1.5 rounded-full bg-red-500/90 hover:bg-red-500 text-white transition-all cursor-pointer shadow-sm text-[11px] font-bold uppercase tracking-wider"
						title="Leave call"
					>
						<PhoneOff className="h-3.5 w-3.5" />
						Leave
					</button>
				</div>
			</div>

			{/* LiveKit Room */}
			{token && livekitUrl && (
				<LiveKitRoom
					serverUrl={livekitUrl}
					token={token}
					connect={true}
					video={callType === "video"}
					audio={true}
					onConnected={handleConnected}
					onDisconnected={handleDisconnected}
					className="flex-1 flex flex-col min-h-0"
				>
					{/* Video grid area */}
					<div className="flex-1 p-2 min-h-0 overflow-hidden">
						<CallParticipants />
					</div>

					<RoomAudioRenderer />

					{/* Controls bar */}
					<CallControls callType={callType} onLeave={onLeave} />
				</LiveKitRoom>
			)}
		</motion.div>
	);
}
