import { useEffect, useRef, lazy, Suspense, useState } from "react";
import { gsap } from "gsap";
import { motion } from "motion/react";
import {
	ArrowDown,
	Globe,
	ArrowRight,
	Compass,
	MessageSquare,
	Activity,
	Bookmark,
} from "lucide-react";
import GlassCard from "./GlassCard";
import SplitText from "./SplitText";
import ShinyText from "./ShinyText";

const LandingSpaceBackdrop = lazy(() => import("./LandingSpaceBackdrop"));

interface LandingPageProps {
	onScrollToAuth: () => void;
	onScrollToSignup?: () => void;
	onExplorePublicFeed?: () => void;
}

export default function LandingPage({
	onScrollToAuth,
	onScrollToSignup,
	onExplorePublicFeed,
}: LandingPageProps) {
	const subtitleRef = useRef<HTMLParagraphElement>(null);
	const ctaRef = useRef<HTMLDivElement>(null);
	const infoRef = useRef<HTMLDivElement>(null);
	const prefersReducedMotion =
		typeof window !== "undefined" &&
		window.matchMedia("(prefers-reduced-motion: reduce)").matches;

	const [isLargeScreen, setIsLargeScreen] = useState(() => {
		if (typeof window === "undefined") return false;
		return window.innerWidth >= 768;
	});

	useEffect(() => {
		if (typeof window === "undefined") return;
		const checkScreen = () => {
			setIsLargeScreen(window.innerWidth >= 768);
		};
		window.addEventListener("resize", checkScreen);
		return () => window.removeEventListener("resize", checkScreen);
	}, []);

	useEffect(() => {
		if (!subtitleRef.current || !ctaRef.current || prefersReducedMotion)
			return;
		// GSAP Entrance timing
		const tl = gsap.timeline();

		tl.fromTo(
			subtitleRef.current,
			{ opacity: 0, y: 30, filter: "blur(8px)" },
			{
				opacity: 1,
				y: 0,
				filter: "blur(0px)",
				duration: 1.0,
				ease: "power3.out",
			},
		);

		tl.fromTo(
			ctaRef.current,
			{ opacity: 0, y: 25, scale: 0.96 },
			{
				opacity: 1,
				y: 0,
				scale: 1,
				duration: 0.8,
				ease: "back.out(1.6)",
			},
			"-=0.7",
		);

		return () => {
			tl.kill();
		};
	}, [prefersReducedMotion]);

	return (
		<div className="relative w-full min-h-screen bg-transparent overflow-hidden flex flex-col justify-between font-sans selection:bg-white/20">
			{/* Fully interactive 3D deep space cosmic backdrop (lazy-loaded) */}
			{isLargeScreen && (
				<Suspense
					fallback={<div className="absolute inset-0 bg-black z-0" />}>
					<LandingSpaceBackdrop />
				</Suspense>
			)}

			{/* 1. Monochromatic Accent Glows */}
			<div className="absolute inset-x-0 -top-40 h-[70vh] bg-linear-to-b from-white/5 via-transparent to-transparent blur-[140px] pointer-events-none -z-10" />

			{/* 2. Top Navigation Bar */}
			<nav className="relative z-20 w-full max-w-7xl mx-auto px-3 py-3 sm:px-6 sm:py-4 flex items-center justify-between pointer-events-auto">
				<motion.div
					onClick={() =>
						window.scrollTo({ top: 0, behavior: "smooth" })
					}
					whileHover={{ scale: 1.05 }}
					className="flex items-center gap-2.5 cursor-pointer group">
					<span className="font-logo text-[14px] font-bold tracking-[0.35em] text-white uppercase transition-colors duration-300">
						ORBIT
					</span>
				</motion.div>

				<div className="flex items-center gap-4">
					<button
						type="button"
						onClick={onScrollToSignup || onScrollToAuth}
						className="rounded-full bg-white text-black hover:bg-zinc-200 px-3 py-1.5 text-[12px] sm:px-3.5 sm:py-1.5 sm:text-sm font-black transition-all cursor-pointer shadow-md hover:scale-105 active:scale-95 uppercase tracking-wider border border-white/25 font-sans">
						Get Started
					</button>
				</div>
			</nav>

			{/* 4. Main Banner / Metallic Centerpiece: Aligned perfectly inside the Hollow Orb */}
			<div className="relative z-10 w-full max-w-4xl mx-auto text-center px-3 py-10 sm:px-6 sm:py-16 flex-1 flex flex-col items-center justify-center select-none pointer-events-none">
				{/* Glow point overlays (strictly monochrome) */}
				<div className="absolute top-10 left-1/4 h-36 w-36 bg-white/5 rounded-full blur-3xl -z-10 animate-pulse" />
				<div className="absolute bottom-10 right-1/4 h-44 w-44 bg-zinc-800/10 rounded-full blur-3xl -z-10 animate-pulse" />

				<div className="space-y-6">
					{/* Title letter reveal with ReactBits SplitText component */}
					<div className="overflow-hidden py-2 select-none">
						<h1 className="text-4xl sm:text-6xl md:text-8xl font-light tracking-wider text-white leading-none relative uppercase select-none">
							<SplitText
								text="ORBIT"
								delay={0.1}
								staggerDelay={0.08}
							/>
						</h1>
					</div>

					<p
						ref={subtitleRef}
						className="text-[11px] md:text-sm font-semibold tracking-[0.2em] text-zinc-300 max-w-xl mx-auto leading-relaxed uppercase border-t border-b border-white/10 py-4 font-sans">
						The Simpler Social Feed. Share thoughts, meet friends,
						and participate in lively discussions without the noise.
					</p>
				</div>

				{/* Action button trigger area */}
				<div
					ref={ctaRef}
					className="mt-7 sm:mt-10 flex flex-col sm:flex-row items-center gap-2.5 sm:gap-4.5 pointer-events-auto">
					<motion.button
						type="button"
						onClick={onScrollToSignup || onScrollToAuth}
						whileHover={{
							scale: 1.05,
							boxShadow: "0 0 35px rgba(255,255,255,0.25)",
						}}
						whileTap={{ scale: 1.02 }}
						className="group flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-[12px] md:text-sm font-black uppercase tracking-widest text-black shadow-2xl transition-all duration-300 cursor-pointer">
						Enter Social Hub
						<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
					</motion.button>

					<motion.button
						type="button"
						onClick={onExplorePublicFeed || onScrollToAuth}
						whileHover={{
							scale: 1.05,
							backgroundColor: "rgba(255, 255, 255, 0.45)",
						}}
						whileTap={{ scale: 0.95 }}
						className="flex items-center gap-2 rounded-full bg-white/40 dark:bg-zinc-950/20 px-6 py-3.5 text-[12px] md:text-sm font-black uppercase tracking-widest text-zinc-100 dark:text-zinc-300 hover:text-white border border-zinc-800/20 backdrop-blur-md transition-all cursor-pointer font-sans">
						<Compass className="h-4 w-4 text-zinc-400 animate-spin-slow shrink-0" />
						Explore Public Feed
					</motion.button>
				</div>
			</div>

			{/* 5. Beautiful Bento Grid Layout with integrated Cursor Spotlight GlassCards */}
			<div className="relative z-10 w-full py-12 px-4 sm:py-16 sm:px-6 bg-linear-to-b from-transparent via-zinc-950/10 to-transparent">
				<div className="max-w-6xl mx-auto">
					<motion.div
						initial={{ opacity: 0, y: 30 }}
						whileInView={{ opacity: 1, y: 0 }}
						viewport={{ once: false, amount: 0.2 }}
						className="text-center space-y-2 mb-12">
						<span className="text-[10px] font-mono font-black text-zinc-400 uppercase tracking-[0.35em] flex items-center justify-center gap-2">
							<span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />{" "}
							Designed for Connection • Simple & Beautiful
						</span>
						<h2 className="text-2xl md:text-3xl font-normal text-white uppercase tracking-[0.2em] font-display">
							<ShinyText
								text="Social Experience Simplified"
								speed={5}
							/>
						</h2>
					</motion.div>

					<div
						ref={infoRef}
						className="grid grid-cols-1 md:grid-cols-6 gap-6 text-left">
						{/* Bento Block 1: Profiles & Statuses (Span 3) */}
						<GlassCard
							id="bento-1"
							animate={true}
							initial={{ opacity: 0, scale: 0.9, y: 40 }}
							whileInView={{ opacity: 1, scale: 1, y: 0 }}
							viewport={{ once: false, amount: 0.15 }}
							transition={{
								type: "spring",
								stiffness: 100,
								damping: 15,
							}}
							whileHover={{ scale: 1.03, y: -8 }}
							className="md:col-span-3 p-6 group flex flex-col justify-between min-h-48">
							<div>
								<div className="h-8 w-8 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-350 mb-4 group-hover:scale-110 group-hover:rotate-6 transition-transform">
									<Globe className="h-4 w-4" />
								</div>
								<h3 className="text-[11px] font-black text-white uppercase tracking-widest mb-2 flex items-center justify-between font-display">
									Sovereign Profiles{" "}
									<span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
								</h3>
								<p className="text-[11px] text-zinc-400 leading-normal font-bold uppercase tracking-tight font-sans">
									Express yourself clearly. Create a custom
									profile card, update your full name, set a
									custom bio, and declare your active status
									icon seamlessly.
								</p>
							</div>
						</GlassCard>

						{/* Bento Block 2: Living Feeds (Span 3) */}
						<GlassCard
							id="bento-2"
							animate={true}
							initial={{ opacity: 0, scale: 0.9, y: 40 }}
							whileInView={{ opacity: 1, scale: 1, y: 0 }}
							viewport={{ once: false, amount: 0.15 }}
							transition={{
								type: "spring",
								stiffness: 100,
								damping: 15,
								delay: 0.1,
							}}
							whileHover={{ scale: 1.03, y: -8 }}
							className="md:col-span-3 p-6 group flex flex-col justify-between min-h-48">
							<div>
								<div className="h-8 w-8 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-350 mb-4 group-hover:scale-110 group-hover:rotate-6 transition-transform">
									<Activity className="h-4 w-4 text-zinc-350" />
								</div>
								<h3 className="text-[11px] font-black text-white uppercase tracking-widest mb-2 flex items-center justify-between font-display">
									Living Social Feed{" "}
									<span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
								</h3>
								<p className="text-[11px] text-zinc-400 leading-normal font-bold uppercase tracking-tight font-sans">
									A high-contrast shared feed where you can
									view posts, upload photos with a fully
									integrated cropper, and like posts
									instantaneously. Always synced, always
									clean.
								</p>
							</div>
						</GlassCard>

						{/* Bento Block 3: Comments (Span 2) */}
						<GlassCard
							id="bento-3"
							animate={true}
							initial={{ opacity: 0, scale: 0.9, y: 40 }}
							whileInView={{ opacity: 1, scale: 1, y: 0 }}
							viewport={{ once: false, amount: 0.15 }}
							transition={{
								type: "spring",
								stiffness: 100,
								damping: 15,
							}}
							whileHover={{ scale: 1.03, y: -8 }}
							className="md:col-span-2 p-6 group flex flex-col justify-between min-h-44">
							<div>
								<div className="h-7 w-7 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-350 mb-3.5 group-hover:scale-110 group-hover:rotate-6 transition-transform">
									<MessageSquare className="h-3.5 w-3.5" />
								</div>
								<h3 className="text-[12px] font-semibold text-slate-900 dark:text-zinc-100 mb-1.5 font-display">
									Comments
								</h3>
								<p className="text-[12px] text-slate-500 dark:text-zinc-400 leading-relaxed font-medium font-sans">
									Join conversations and share your thoughts
									on posts.
								</p>
							</div>
						</GlassCard>

						{/* Bento Block 4: Friendly Direct Chats (Span 2) */}
						<GlassCard
							id="bento-4"
							animate={true}
							initial={{ opacity: 0, scale: 0.9, y: 40 }}
							whileInView={{ opacity: 1, scale: 1, y: 0 }}
							viewport={{ once: false, amount: 0.15 }}
							transition={{
								type: "spring",
								stiffness: 100,
								damping: 15,
								delay: 0.1,
							}}
							whileHover={{ scale: 1.03, y: -8 }}
							className="md:col-span-2 p-6 group flex flex-col justify-between min-h-44">
							<div>
								<div className="h-8.5 w-8.5 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-350 mb-5 group-hover:scale-110 group-hover:rotate-6 transition-transform">
									<MessageSquare className="h-4 w-4" />
								</div>
								<h3 className="text-[11px] font-black text-white uppercase tracking-widest mb-2 flex items-center justify-between font-display">
									Direct Messages{" "}
									<span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
								</h3>
								<p className="text-[11px] text-zinc-400 leading-relaxed font-bold uppercase tracking-tight font-sans">
									Private direct conversations to connect
									straight with other users, featuring
									responsive text, instant message listeners,
									and interactive chat sheets.
								</p>
							</div>
						</GlassCard>

						{/* Bento Block 5: Saved Indexes (Span 2) */}
						<GlassCard
							id="bento-5"
							animate={true}
							initial={{ opacity: 0, scale: 0.9, y: 40 }}
							whileInView={{ opacity: 1, scale: 1, y: 0 }}
							viewport={{ once: false, amount: 0.15 }}
							transition={{
								type: "spring",
								stiffness: 100,
								damping: 15,
								delay: 0.2,
							}}
							whileHover={{ scale: 1.03, y: -8 }}
							className="md:col-span-2 p-6 group flex flex-col justify-between min-h-44">
							<div>
								<div className="h-7 w-7 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-350 mb-3.5 group-hover:scale-110 group-hover:rotate-6 transition-transform">
									<Bookmark className="h-3.5 w-3.5" />
								</div>
								<h3 className="text-[11px] font-black text-white uppercase tracking-widest mb-2 flex items-center justify-between font-display">
									Saved Bookmarks{" "}
									<span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
								</h3>
								<p className="text-[11px] text-zinc-400 leading-relaxed font-bold uppercase tracking-tight font-sans">
									Keep your favorite posts safe. Bookmark any
									post and view them securely inside a
									designated bookmarks shelf for quick and
									easy reference anytime.
								</p>
							</div>
						</GlassCard>
					</div>
				</div>
			</div>

			{/* 6. Footer Cues */}
			<div className="relative z-10 w-full py-8 flex justify-center pointer-events-auto">
				<button
					onClick={onScrollToAuth}
					className="flex flex-col items-center gap-2 text-zinc-500 hover:text-white tracking-[0.25em] text-[11px] uppercase font-black transition-all cursor-pointer group">
					<span>Scroll to login & signup layer</span>
					<ArrowDown className="h-4 w-4 animate-bounce text-zinc-500 group-hover:translate-y-1 transition-transform" />
				</button>
			</div>
		</div>
	);
}
