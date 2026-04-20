import React from 'react';
import { Share2 } from 'lucide-react';

interface KTopBarProps {
    onUplink?: () => void;
    uplinkLabel?: string;
    title?: string;
    accentColor?: string;
    themeColor?: string; // e.g., 'text-cyan-400' or hex, but tailwind classes might be safer for now if we use dynamic values carefully
    className?: string;
    left?: React.ReactNode;
    right?: React.ReactNode;
    leftContent?: React.ReactNode;
    rightContent?: React.ReactNode;
}

export default function KTopBar({
    onUplink,
    uplinkLabel = "UPLINK TO KERNEL",
    title,
    accentColor,
    themeColor = "#00ffcc", // Default generic cyan/teal if not specified
    className = "",
    left,
    right,
    leftContent,
    rightContent
}: KTopBarProps) {
    const resolvedThemeColor = accentColor ?? themeColor;
    const resolvedLeftContent = left ?? leftContent;
    const resolvedRightContent = right ?? rightContent;

    // Dynamic styles for the glow based on the theme color
    // note: using inline styles for dynamic colors is often easier than generating tailwind classes on the fly
    const glowStyle = {
        boxShadow: `0 0 30px ${resolvedThemeColor}33`, // 20% opacity hex
        borderColor: `${resolvedThemeColor}80`,
    };

    const textStyle = {
        color: resolvedThemeColor
    };

    return (
        <div className={`absolute top-4 left-4 right-4 h-14 bg-[#0a0a0a]/80 backdrop-blur-xl border border-[#333]/50 rounded-2xl flex items-center justify-between px-6 z-40 shadow-2xl animate-in slide-in-from-top-2 ${className}`}>

            {/* LEFT CONTENT SLOT */}
            <div className="flex items-center gap-6 flex-1 justify-start">
                {title && (
                    <div className="text-[10px] font-bold tracking-[0.24em] uppercase" style={textStyle}>
                        {title}
                    </div>
                )}
                {resolvedLeftContent}
            </div>

            {/* CENTER: UPLINK BUTTON */}
            <div className="flex items-center justify-center shrink-0 mx-4">
                {onUplink && (
                    <button
                        onClick={onUplink}
                        className="relative group overflow-hidden px-8 py-2 rounded-full font-bold text-[10px] tracking-[0.2em] transition-all duration-300 hover:brightness-125 border border-opacity-50"
                        style={{
                            ...glowStyle,
                            ...textStyle,
                            backgroundColor: 'rgba(0,0,0,0.6)'
                        }}
                    >
                        {/* Shimmer Effect */}
                        <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-shimmer pointer-events-none" />

                        <div className="relative z-10 flex items-center gap-2 transition-colors">
                            <Share2 size={14} className="group-hover:rotate-12 transition-transform" />
                            {uplinkLabel}
                        </div>
                    </button>
                )}
            </div>

            {/* RIGHT CONTENT SLOT */}
            <div className="flex items-center gap-6 flex-1 justify-end">
                {resolvedRightContent}
            </div>
        </div>
    );
}
