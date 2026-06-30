"use client";

// src/components/notifications/EmptyInboxState.tsx
//
// Shown when a user has zero inbox-eligible notifications yet. The
// illustration is hand-built inline SVG (a bell with a soft sparkle,
// in FoodKnock's warm orange palette) rather than a stock icon-in-a-circle
// — small enough to keep this file self-contained, distinctive enough not
// to read as a generic empty state.

import { motion } from "framer-motion";

export default function EmptyInboxState() {
    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="flex flex-col items-center px-6 py-20 text-center"
        >
            <svg
                width="120"
                height="120"
                viewBox="0 0 120 120"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
                className="mb-6"
            >
                <circle cx="60" cy="62" r="46" fill="#FFF3E8" />
                <path
                    d="M60 32c-12 0-20 9.5-20 22v9c0 3-1.5 5.7-4 8l-2 2h52l-2-2c-2.5-2.3-4-5-4-8v-9c0-12.5-8-22-20-22Z"
                    fill="url(#bellGradient)"
                />
                <path d="M52 81a8 8 0 0 0 16 0H52Z" fill="#C2410C" />
                <path
                    d="M88 38l2.4 5.6L96 46l-5.6 2.4L88 54l-2.4-5.6L80 46l5.6-2.4L88 38Z"
                    fill="#FF5C1A"
                />
                <defs>
                    <linearGradient id="bellGradient" x1="40" y1="32" x2="80" y2="81" gradientUnits="userSpaceOnUse">
                        <stop stopColor="#FF8C42" />
                        <stop offset="1" stopColor="#FF5C1A" />
                    </linearGradient>
                </defs>
            </svg>

            <h2
                className="text-[19px] font-black text-stone-800"
                style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
            >
                Quiet in here for now
            </h2>
            <p className="mt-2 max-w-[260px] text-[13px] leading-relaxed text-stone-500">
                We&apos;ll let you know the moment your order moves — placed, prepped, on the way, delivered.
            </p>
        </motion.div>
    );
}