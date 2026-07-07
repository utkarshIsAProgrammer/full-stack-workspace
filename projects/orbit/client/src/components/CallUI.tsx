import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import {
	Mic,
	MicOff,
	PhoneOff,
	Phone,
	Video,
	VideoOff,
	Volume2,
	RefreshCw,
} from "lucide-react";
import type { Socket } from "socket.io-client";
import UserAvatar from "./UserAvatar";
import { logger } from "../utils/logger";

interface CallUIProps {
	socket: Socket | null;
	user: { _id: string; fullName: string; profilePic?: { url?: string } };
	callState: {
		type: "audio" | "video";
		status: "outgoing" | "incoming" | "active";
		partnerId: string;
		partnerName: string;
		partnerAvatar?: string;
	};
	onEndCall: () => void;
	onAcceptCall: () => void;
	onRejectCall: () => void;
	localStreamRef: React.MutableRefObject<MediaStream | null>;
	peerConnectionRef: React.MutableRefObject<RTCPeerConnection | null>;
	remoteStreamRef: React.MutableRefObject<MediaStream | null>;
	iceConnectionState: RTCIceConnectionState | "new";
}

export default function CallUI({
	callState,
	user,
	onEndCall,
	onAcceptCall,
	onRejectCall,
	localStreamRef,
	peerConnectionRef,
	remoteStreamRef,
	iceConnectionState,
}: CallUIProps) {
	const [isMuted, setIsMuted] = useState(false);
	const [isVideoOff, setIsVideoOff] = useState(false);
	const [isSpeakerOn, setIsSpeakerOn] = useState(true);
	const [facingMode, setFacingMode] = useState<"user" | "environment">(
		"user",
	);
	const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
	const [callDuration, setCallDuration] = useState(0);
	const [micLevel, setMicLevel] = useState(0); // 0–100 for the volume meter
	const localVideoRef = useRef<HTMLVideoElement>(null);
	const remoteVideoRef = useRef<HTMLVideoElement>(null);
	const remoteAudioRef = useRef<HTMLAudioElement>(null);
	const durationTimerRef = useRef<NodeJS.Timeout | null>(null);
	const audioContextRef = useRef<AudioContext | null>(null);
	const analyserRef = useRef<AnalyserNode | null>(null);
	const animationFrameRef = useRef<number | null>(null);
	// Ringtone refs
	const ringtoneCtxRef = useRef<AudioContext | null>(null);
	const ringtoneOsc1Ref = useRef<OscillatorNode | null>(null);
	const ringtoneOsc2Ref = useRef<OscillatorNode | null>(null);
	const ringtoneGainRef = useRef<GainNode | null>(null);
	const ringtoneTimerRef = useRef<NodeJS.Timeout | null>(null);
	const vibrationIntervalRef = useRef<NodeJS.Timeout | null>(null);

	// ─── Ringtone + Vibration for Incoming Calls ───────────────
	// Generates a pleasant melodic ringtone using Web Audio API.
	// Uses two triangle-wave oscillators playing a short ascending
	// four-note phrase (440→523→587→440 Hz) in a repeating pattern,
	// with a soft attack/release envelope.
	const startRingtone = () => {
		try {
			const ctx = new AudioContext();
			ringtoneCtxRef.current = ctx;

			// Two triangle-wave oscillators — triangle is warmer/softer than sine
			const osc1 = ctx.createOscillator();
			osc1.type = "triangle";
			osc1.frequency.value = 440;

			const osc2 = ctx.createOscillator();
			osc2.type = "triangle";
			osc2.frequency.value = 523;

			const gain = ctx.createGain();
			gain.gain.value = 0;

			osc1.connect(gain);
			osc2.connect(gain);
			gain.connect(ctx.destination);

			osc1.start();
			osc2.start();

			ringtoneOsc1Ref.current = osc1;
			ringtoneOsc2Ref.current = osc2;
			ringtoneGainRef.current = gain;

			// Attempt to resume AudioContext
			ctx.resume().catch(() => {});

			// ── Musical ring pattern ──
			// A repeating 4-note ascending phrase: 440→523→587→440 Hz
			// Each note rings for ~250ms with a 50ms gap between notes.
			// After the 4-note phrase, there's a ~600ms silence, then repeat.
			const notes = [
				{ freq1: 440, freq2: 523, dur: 0.25 },
				{ freq1: 523, freq2: 587, dur: 0.25 },
				{ freq1: 587, freq2: 659, dur: 0.25 },
				{ freq1: 440, freq2: 523, dur: 0.35 }, // slightly longer final note
			];
			const noteGap = 0.05; // 50ms gap between notes
			const phrasePause = 0.6; // 600ms pause before repeating
			const phraseDuration =
				notes.reduce((acc, n) => acc + n.dur + noteGap, 0) +
				phrasePause;

			const schedulePhrase = () => {
				const ctxAlive = ringtoneCtxRef.current;
				if (!ctxAlive || ctxAlive.state === "closed") return;

				const baseTime = ctxAlive.currentTime;

				// Schedule each note in the phrase
				let noteTime = baseTime;
				notes.forEach((note) => {
					// Attack: ramp up to volume
					gain.gain.setValueAtTime(0, noteTime);
					gain.gain.linearRampToValueAtTime(0.25, noteTime + 0.02);

					// Set frequencies for this note
					osc1.frequency.setValueAtTime(note.freq1, noteTime);
					osc2.frequency.setValueAtTime(note.freq2, noteTime);

					// Release: fade out before next note
					const noteEnd = noteTime + note.dur;
					gain.gain.setValueAtTime(0.25, noteEnd - 0.02);
					gain.gain.linearRampToValueAtTime(0, noteEnd);

					noteTime = noteEnd + noteGap;
				});
			};

			// Schedule the first phrase immediately
			schedulePhrase();
			// Repeat the phrase
			ringtoneTimerRef.current = setInterval(
				schedulePhrase,
				phraseDuration * 1000,
			);
		} catch (err) {
			logger.warn("Ringtone unavailable:", err);
		}
	};

	const stopRingtone = () => {
		if (ringtoneTimerRef.current) {
			clearInterval(ringtoneTimerRef.current);
			ringtoneTimerRef.current = null;
		}
		if (ringtoneOsc1Ref.current) {
			try {
				ringtoneOsc1Ref.current.stop();
			} catch {
				/* already stopped */
			}
			ringtoneOsc1Ref.current = null;
		}
		if (ringtoneOsc2Ref.current) {
			try {
				ringtoneOsc2Ref.current.stop();
			} catch {
				/* already stopped */
			}
			ringtoneOsc2Ref.current = null;
		}
		if (ringtoneCtxRef.current) {
			ringtoneCtxRef.current.close().catch(() => {});
			ringtoneCtxRef.current = null;
		}
		ringtoneGainRef.current = null;
	};

	const startVibration = () => {
		if (!("vibrate" in navigator)) return;
		// Pattern: vibrate 400ms, pause 200ms — matches ringtone rhythm
		const pattern: VibratePattern = [400, 200];
		// First vibrate immediately
		navigator.vibrate(pattern);
		// Repeat every 600ms to create a continuous loop
		vibrationIntervalRef.current = setInterval(() => {
			navigator.vibrate(pattern);
		}, 600);
	};

	const stopVibration = () => {
		if (vibrationIntervalRef.current) {
			clearInterval(vibrationIntervalRef.current);
			vibrationIntervalRef.current = null;
		}
		if ("vibrate" in navigator) {
			navigator.vibrate(0); // Cancel any ongoing vibration
		}
	};

	// Manage ringtone + vibration based on call status
	useEffect(() => {
		if (callState.status === "incoming") {
			startRingtone();
			startVibration();
		} else {
			stopRingtone();
			stopVibration();
		}
		return () => {
			stopRingtone();
			stopVibration();
		};
	}, [callState.status]);

	// Wire local stream to local video element when call becomes active
	useEffect(() => {
		if (localVideoRef.current && localStreamRef.current) {
			localVideoRef.current.srcObject = localStreamRef.current;
		}
	}, [callState.status]);

	// Wire remote stream to remote video/audio elements
	// Uses multiple fallback sources to handle track timing:
	// 1. remoteStreamRef (set by App.tsx's pc.ontrack to catch tracks early)
	// 2. pc.getReceivers() (tracks already negotiated on the peer connection)
	// 3. pc.ontrack (future tracks that arrive later)
	useEffect(() => {
		const pc = peerConnectionRef.current;
		if (!pc) return;

		const wireAudioTrack = (track: MediaStreamTrack) => {
			if (remoteAudioRef.current) {
				const existing = remoteAudioRef.current
					.srcObject as MediaStream | null;
				if (existing && existing.getAudioTracks().includes(track))
					return;
				const stream = new MediaStream([track]);
				remoteAudioRef.current.srcObject = stream;
				remoteAudioRef.current?.play()?.catch(() => {});
			}
		};

		const wireVideoTrack = (track: MediaStreamTrack) => {
			if (remoteVideoRef.current) {
				const existing = remoteVideoRef.current
					.srcObject as MediaStream | null;
				if (existing && existing.getVideoTracks().includes(track))
					return;
				const stream = new MediaStream([track]);
				remoteVideoRef.current.srcObject = stream;
			}
		};

		// Source 1: Check remoteStreamRef for tracks that arrived before mount
		if (remoteStreamRef.current) {
			const remoteStream = remoteStreamRef.current;
			remoteStream.getAudioTracks().forEach(wireAudioTrack);
			remoteStream.getVideoTracks().forEach(wireVideoTrack);
		}

		// Source 2: Check pc.getReceivers() for already-negotiated remote tracks
		pc.getReceivers().forEach((receiver) => {
			if (receiver.track.kind === "audio") {
				wireAudioTrack(receiver.track);
			} else if (receiver.track.kind === "video") {
				wireVideoTrack(receiver.track);
			}
		});

		// Source 3: Set up ontrack for future remote tracks
		const handleTrack = (e: RTCTrackEvent) => {
			if (e.track.kind === "audio") {
				wireAudioTrack(e.track);
			} else if (e.track.kind === "video") {
				wireVideoTrack(e.track);
			}
		};

		pc.ontrack = handleTrack;

		return () => {
			if (pc.ontrack === handleTrack) {
				pc.ontrack = null;
			}
		};
	}, [callState.status, callState.type]);

	// ─── Speaker / Earpiece Toggle ─────────────────────────────────────
	// Switches audio output between loudspeaker (speakerphone mode) and earpiece/receiver.
	// Uses the modern audio.setSinkId() API when available (Chrome, Edge, Samsung Internet).
	// On mobile phones:
	//   - "default" routes to the earpiece (proximity-aware handset speaker)
	//   - The loudspeaker is a separate audio output device that must be found by label
	//   - The earpiece device label is NOT always present, so we default to "" for earpiece
	const toggleSpeaker = async () => {
		const newSpeakerOn = !isSpeakerOn;
		setIsSpeakerOn(newSpeakerOn);

		const audioEl = remoteAudioRef.current;
		if (!audioEl) return;

		// Check if setSinkId is supported
		if (
			"setSinkId" in audioEl &&
			typeof (audioEl as any).setSinkId === "function"
		) {
			try {
				const devices = await navigator.mediaDevices.enumerateDevices();
				const audioOutputs = devices.filter(
					(d) => d.kind === "audiooutput",
				);

				if (newSpeakerOn) {
					// Speakerphone: find loudspeaker device by label keywords
					// On most phones, the speaker is labeled "Speaker" or "Speakerphone".
					// If no specific speaker is found, pick the first non-default audio output.
					const speaker = audioOutputs.find(
						(d) =>
							d.label.toLowerCase().includes("speaker") ||
							d.label.toLowerCase().includes("loudspeaker") ||
							d.label.toLowerCase().includes("speakerphone"),
					);
					const speakerId = speaker?.deviceId || "";
					await (audioEl as any).setSinkId(speakerId);
				} else {
					// Earpiece: use the default audio output (handset earpiece on phones)
					await (audioEl as any).setSinkId("");
				}
			} catch (err) {
				logger.warn("Speaker toggle: setSinkId failed", err);
				setIsSpeakerOn(!newSpeakerOn); // revert
			}
		}
	};

	// ─── Camera Switch (Front / Back) ───────────────────────────────────
	// Toggles between front-facing (user) and rear-facing (environment) cameras.
	// Stops the current video track, gets a new one with the opposite facingMode,
	// and replaces it on the peer connection via replaceTrack().
	const switchCamera = async () => {
		const newFacingMode = facingMode === "user" ? "environment" : "user";

		const pc = peerConnectionRef.current;
		const localStream = localStreamRef.current;
		if (!pc || !localStream) return;

		try {
			// Stop current video tracks
			localStream.getVideoTracks().forEach((t) => t.stop());

			// Get new stream with opposite facing mode
			const newStream = await navigator.mediaDevices.getUserMedia({
				audio: false,
				video: { facingMode: newFacingMode },
			});

			const newVideoTrack = newStream.getVideoTracks()[0];
			if (!newVideoTrack) {
				newStream.getTracks().forEach((t) => t.stop());
				return;
			}

			// Remove old video tracks from local stream
			localStream
				.getVideoTracks()
				.forEach((t) => localStream.removeTrack(t));

			// Add new video track to local stream
			localStream.addTrack(newVideoTrack);

			// Replace track on peer connection
			const sender = pc
				.getSenders()
				.find((s) => s.track?.kind === "video");
			if (sender) {
				await sender.replaceTrack(newVideoTrack);
			}

			// Update local video preview
			if (localVideoRef.current) {
				localVideoRef.current.srcObject = localStream;
			}

			setFacingMode(newFacingMode);
		} catch (err) {
			logger.warn("Failed to switch camera:", err);
			// Revert facing mode on failure
			setFacingMode(facingMode);
		}
	};

	// Detect available cameras on mount — only show switch button if multiple cameras exist
	useEffect(() => {
		if (callState.type !== "video") return;
		navigator.mediaDevices
			.enumerateDevices()
			.then((devices) => {
				const videoInputs = devices.filter(
					(d) => d.kind === "videoinput",
				);
				setHasMultipleCameras(videoInputs.length > 1);
			})
			.catch(() => {
				setHasMultipleCameras(false);
			});
	}, [callState.type]);

	// ─── Microphone Volume Meter ───────────────────────────────────
	// Uses Web Audio API's AnalyserNode to compute RMS volume from the local
	// microphone stream and updates a 0–100 level state on every animation frame.
	useEffect(() => {
		const stream = localStreamRef.current;
		if (!stream || callState.status !== "active") return;

		try {
			const audioCtx = new AudioContext();
			audioContextRef.current = audioCtx;
			const source = audioCtx.createMediaStreamSource(stream);
			const analyser = audioCtx.createAnalyser();
			analyser.fftSize = 256;
			source.connect(analyser);
			analyserRef.current = analyser;

			const dataArray = new Uint8Array(analyser.frequencyBinCount);

			const tick = () => {
				if (!analyserRef.current) return;
				analyserRef.current.getByteTimeDomainData(dataArray);

				// Compute RMS (root mean square) — a good proxy for perceived loudness
				let sum = 0;
				for (let i = 0; i < dataArray.length; i++) {
					const val = (dataArray[i] - 128) / 128; // Normalize to [-1, 1]
					sum += val * val;
				}
				const rms = Math.sqrt(sum / dataArray.length);
				// Scale to 0–100 with a sensitivity boost for quieter speech
				const level = Math.min(100, Math.round(rms * 180));
				setMicLevel(level);

				animationFrameRef.current = requestAnimationFrame(tick);
			};

			tick();
		} catch (err) {
			// AudioContext may fail on insecure origins or older browsers
			logger.warn("Mic meter unavailable:", err);
		}

		return () => {
			if (animationFrameRef.current) {
				cancelAnimationFrame(animationFrameRef.current);
				animationFrameRef.current = null;
			}
			if (audioContextRef.current) {
				audioContextRef.current.close();
				audioContextRef.current = null;
			}
			setMicLevel(0);
		};
	}, [callState.status]);

	// Start call duration timer when active; also trigger remote audio playback
	// (iOS Safari blocks autoplay but the user's Accept tap establishes a gesture chain)
	useEffect(() => {
		if (callState.status === "active") {
			setCallDuration(0);
			durationTimerRef.current = setInterval(() => {
				setCallDuration((prev) => prev + 1);
			}, 1000);

			// Retry playback on the remote audio element now that we're in a user gesture context
			if (remoteAudioRef.current) {
				remoteAudioRef.current?.play()?.catch(() => {
					// Silently ignore — audio will be played on first user tap
				});
			}
			// Stop ringtone now that call is active (status-change effect already
			// handles this, but this is a safety net for edge cases)
		}
		return () => {
			if (durationTimerRef.current) {
				clearInterval(durationTimerRef.current);
				durationTimerRef.current = null;
			}
		};
	}, [callState.status]);

	// Fallback: tap anywhere during the call to unlock iOS Safari audio
	const handleCallTap = () => {
		if (remoteAudioRef.current && callState.status === "active") {
			remoteAudioRef.current?.play()?.catch(() => {});
		}
	};

	const formatDuration = (s: number) => {
		const m = Math.floor(s / 60);
		const sec = s % 60;
		return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
	};

	const toggleMute = () => {
		if (localStreamRef.current) {
			localStreamRef.current.getAudioTracks().forEach((track) => {
				track.enabled = isMuted;
			});
			setIsMuted(!isMuted);
		}
	};

	const toggleVideo = () => {
		if (localStreamRef.current) {
			localStreamRef.current.getVideoTracks().forEach((track) => {
				track.enabled = isVideoOff;
			});
			setIsVideoOff(!isVideoOff);
		}
	};

	return (
		<motion.div
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			exit={{ opacity: 0 }}
			onClick={handleCallTap}
			className="fixed inset-0 z-[340] bg-black/90 backdrop-blur-2xl flex flex-col items-center justify-center">
			{/* Remote video (full background for video calls) — hidden behind content overlay */}
			{callState.type === "video" && (
				<video
					ref={remoteVideoRef}
					autoPlay
					playsInline
					className="absolute inset-0 w-full h-full object-cover"
				/>
			)}

			{/* Hidden remote audio element for audio-only calls — ensures explicit media
          element ownership for autoplay compliance on mobile browsers */}
			<audio ref={remoteAudioRef} autoPlay playsInline />

			{/* Dark overlay for better UI contrast (video calls) or full background (audio calls) */}
			<div className="absolute inset-0 bg-black/40" />

			{/* Content */}
			<div className="relative z-10 flex flex-col items-center gap-6 w-full max-w-md px-6">
				{/* Partner info */}
				<div className="text-center">
					<div className="relative inline-flex">
						<UserAvatar
							src={callState.partnerAvatar}
							alt={callState.partnerName}
							className={`rounded-full object-cover border-2 border-zinc-700 shadow-2xl ${
								callState.type === "video" &&
								callState.status === "active"
									? "h-20 w-20"
									: "h-28 w-28"
							}`}
						/>
						{callState.status === "outgoing" && (
							<motion.div
								animate={{ scale: [1, 1.2, 1] }}
								transition={{ repeat: Infinity, duration: 1.5 }}
								className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-green-500 border-2 border-black"
							/>
						)}
					</div>
					<h3 className="text-xl font-bold text-white mt-4">
						{callState.partnerName}
					</h3>
					<p className="text-sm text-zinc-400 mt-1">
						{callState.status === "outgoing" && "Calling..."}
						{callState.status === "incoming" && "Incoming call"}
						{callState.status === "active" &&
							formatDuration(callDuration)}
					</p>
					{callState.status === "active" &&
						(iceConnectionState === "disconnected" ||
							iceConnectionState === "failed") && (
							<motion.div
								initial={{ opacity: 0, y: -5 }}
								animate={{ opacity: 1, y: 0 }}
								className="flex items-center justify-center gap-1.5 mt-3">
								<span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
								<span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">
									Reconnecting...
								</span>
							</motion.div>
						)}
				</div>

				{/* Local video preview (picture-in-picture for video calls) */}
				{/* Remote video is fullscreen background; local user video is a small PiP at bottom-right */}
				{callState.type === "video" && (
					<div className="absolute bottom-28 right-6 w-32 h-48 rounded-2xl overflow-hidden border-2 border-zinc-700 shadow-2xl">
						<video
							ref={localVideoRef}
							autoPlay
							playsInline
							muted
							className={`w-full h-full object-cover ${isVideoOff ? "opacity-0" : ""}`}
						/>
						{/* Avatar overlay when local video is hidden by the user */}
						{isVideoOff && (
							<div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
								<UserAvatar
									src={user.profilePic?.url}
									alt={user.fullName}
									className="h-14 w-14 rounded-full object-cover border-2 border-zinc-700 opacity-70"
								/>
							</div>
						)}
					</div>
				)}

				{/* Microphone volume meter — visible during active calls */}
				{callState.status === "active" && (
					<div className="flex items-center justify-center gap-[3px] h-8 w-full max-w-[140px]">
						{Array.from({ length: 20 }).map((_, i) => {
							// Each bar lights up when the mic level exceeds a threshold
							const threshold = ((i + 1) / 20) * 100;
							const active = micLevel >= threshold && !isMuted;
							const height = 4 + (i / 20) * 24; // 4px → 28px, tapered
							return (
								<span
									key={i}
									className="w-[5px] rounded-full transition-all duration-75"
									style={{
										height: `${height}px`,
										backgroundColor: active
											? threshold > 70
												? "rgb(239 68 68)" // red for loud
												: threshold > 40
													? "rgb(251 191 36)" // amber for medium
													: "rgb(52 211 153)" // green for quiet
											: "rgba(255,255,255,0.12)",
									}}
								/>
							);
						})}
					</div>
				)}

				{/* Call controls */}
				<div className="flex items-center justify-center gap-4 mt-6 flex-wrap">
					{/* Speaker toggle — only during active calls */}
					{callState.status === "active" && (
						<button
							onClick={toggleSpeaker}
							className={`h-12 w-12 rounded-full flex items-center justify-center transition-all cursor-pointer ${
								isSpeakerOn
									? "bg-zinc-800/80 text-white hover:bg-zinc-700 border border-zinc-700"
									: "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30"
							}`}
							title={
								isSpeakerOn
									? "Switch to earpiece"
									: "Switch to speaker"
							}
							aria-label={
								isSpeakerOn
									? "Switch to earpiece"
									: "Switch to speaker"
							}>
							<Volume2 className="h-4 w-4" />
						</button>
					)}

					{/* Camera switch (front/back) — only during active video calls with multiple cameras */}
					{callState.type === "video" &&
						callState.status === "active" &&
						hasMultipleCameras && (
							<button
								onClick={switchCamera}
								className="h-12 w-12 rounded-full bg-zinc-800/80 text-white hover:bg-zinc-700 border border-zinc-700 flex items-center justify-center transition-all cursor-pointer"
								title="Switch camera"
								aria-label="Switch camera">
								<RefreshCw className="h-4 w-4" />
							</button>
						)}

					{/* Mute button */}
					<button
						onClick={toggleMute}
						className={`h-14 w-14 rounded-full flex items-center justify-center transition-all cursor-pointer ${
							isMuted
								? "bg-red-500/20 text-red-400 border border-red-500/30"
								: "bg-zinc-800/80 text-white hover:bg-zinc-700 border border-zinc-700"
						}`}>
						{isMuted ? (
							<MicOff className="h-5 w-5" />
						) : (
							<Mic className="h-5 w-5" />
						)}
					</button>

					{/* Video toggle (only for video calls) */}
					{callState.type === "video" &&
						callState.status === "active" && (
							<button
								onClick={toggleVideo}
								className={`h-14 w-14 rounded-full flex items-center justify-center transition-all cursor-pointer ${
									isVideoOff
										? "bg-red-500/20 text-red-400 border border-red-500/30"
										: "bg-zinc-800/80 text-white hover:bg-zinc-700 border border-zinc-700"
								}`}>
								{isVideoOff ? (
									<VideoOff className="h-5 w-5" />
								) : (
									<Video className="h-5 w-5" />
								)}
							</button>
						)}

					{/* End / Reject call */}
					<button
						onClick={
							callState.status === "incoming"
								? onRejectCall
								: onEndCall
						}
						className="h-14 w-14 rounded-full bg-red-500 text-white hover:bg-red-600 flex items-center justify-center transition-all cursor-pointer shadow-lg shadow-red-500/30">
						<PhoneOff className="h-5 w-5" />
					</button>

					{/* Accept call (incoming only) */}
					{callState.status === "incoming" && (
						<button
							onClick={onAcceptCall}
							className="h-14 w-14 rounded-full bg-green-500 text-white hover:bg-green-600 flex items-center justify-center transition-all cursor-pointer shadow-lg shadow-green-500/30 animate-pulse">
							<Phone className="h-5 w-5" />
						</button>
					)}
				</div>
			</div>
		</motion.div>
	);
}
