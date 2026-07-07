import React from "react";
import { motion, type MotionProps } from "motion/react";

interface GlassCardProps {
	children: React.Key | React.ReactNode;
	className?: string;
	onClick?: () => void;
	id?: string;
	animate?: boolean;
	showMacControls?: boolean;
	key?: React.Key;
	initial?: MotionProps["initial"];
	whileInView?: MotionProps["whileInView"];
	viewport?: MotionProps["viewport"];
	transition?: MotionProps["transition"];
	whileHover?: MotionProps["whileHover"];
}

export default React.memo(function GlassCard({
	children,
	className = "",
	onClick,
	id,
	animate = true,
	initial,
	whileInView,
	viewport,
	transition,
	whileHover,
}: GlassCardProps) {
	// Fluid, premium liquid glass class combinations for Dark Space macOS glass feel
	const baseClasses = `relative overflow-hidden rounded-2xl sm:rounded-3xl border border-white/10 bg-zinc-950/95 backdrop-blur-none sm:bg-zinc-950/70 sm:backdrop-blur-md px-4 py-4 sm:px-5 sm:py-5 shadow-[0_25px_65px_-15px_rgba(0,0,0,0.85)] hover:border-white/20 transition-all duration-300 ${
		onClick ? "cursor-pointer" : ""
	} ${className}`;

	const GlassGlossOverlay = () => (
		<>
			{/* Edge-light sheen */}
			<div className="absolute inset-x-0 top-0 h-[1px] bg-linear-to-r from-transparent via-white/40 dark:via-white/10 to-transparent pointer-events-none z-20" />
			{/* Translucent top ambient glare */}
			<div className="absolute inset-x-0 top-0 h-[25%] bg-linear-to-b from-white/15 dark:from-white/2 to-transparent pointer-events-none z-10 rounded-t-2xl" />
		</>
	);

	if (!animate) {
		return (
			<div id={id} className={baseClasses} onClick={onClick}>
				<GlassGlossOverlay />
				<div className="relative z-10">{children}</div>
			</div>
		);
	}

	return (
		<motion.div
			id={id}
			initial={initial || { opacity: 0, y: 4 }}
			whileInView={whileInView}
			viewport={viewport}
			whileHover={whileHover}
			animate={whileInView ? undefined : { opacity: 1, y: 0 }}
			exit={{ opacity: 0, y: -4 }}
			transition={
				transition || { duration: 0.1, ease: "easeOut" }
			}
			className={baseClasses}
			onClick={onClick}>
			<GlassGlossOverlay />
			<div className="relative z-10 w-full h-full">{children}</div>
		</motion.div>
	);
});
