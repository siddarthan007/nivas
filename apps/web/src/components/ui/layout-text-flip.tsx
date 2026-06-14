"use client";

import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

// Utility function for class merging
const cn = (...inputs: (string | undefined | null | false)[]) => inputs.filter(Boolean).join(" ");

export const LayoutTextFlip = ({
    text,
    words,
    duration = 0.5,
    delay = 2000,
    className,
}: {
    text: string;
    words: string[];
    duration?: number;
    delay?: number;
    className?: string;
}) => {
    const [index, setIndex] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setIndex((current) => (current + 1) % words.length);
        }, delay);
        return () => clearInterval(interval);
    }, [words.length, delay]);

    return (
        <div className={cn("flex flex-col md:flex-row items-center justify-center gap-2 text-center", className)}>
            <span className="whitespace-nowrap">{text}</span>
            <div className="relative inline-flex items-center justify-center overflow-hidden h-[1.5em] min-w-[120px]">
                <AnimatePresence mode="popLayout">
                    <motion.div
                        key={index}
                        initial={{ y: 50, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -50, opacity: 0 }}
                        transition={{ duration: 0.4, ease: "easeInOut" }}
                        className="absolute flex items-center justify-center text-center w-full"
                    >
                        <span className="font-bold text-[#2383e2] drop-shadow-sm">{words[index]}</span>
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
};