"use client";

import { motion, AnimatePresence, type Variants } from "framer-motion";
import type { ReactNode } from "react";

// Pathname detection for non-Next.js projects
const usePathname = () => {
    return typeof window !== 'undefined' ? window.location.pathname : '/';
};

interface PageTransitionProps {
    children: ReactNode;
}

const pageVariants: Variants = {
    initial: {
        opacity: 0,
        y: 8,
    },
    animate: {
        opacity: 1,
        y: 0,
        transition: {
            duration: 0.2,
            ease: [0.25, 0.1, 0.25, 1],
        },
    },
    exit: {
        opacity: 0,
        y: -8,
        transition: {
            duration: 0.15,
        },
    },
};

export default function PageTransition({ children }: PageTransitionProps) {
    const pathname = usePathname();

    return (
        <AnimatePresence mode="wait">
            <motion.div
                key={pathname}
                initial="initial"
                animate="animate"
                exit="exit"
                variants={pageVariants}
                style={{ width: "100%" }}
            >
                {children}
            </motion.div>
        </AnimatePresence>
    );
}

// Simpler fade transition for content within pages
export function ContentTransition({ children }: PageTransitionProps) {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
        >
            {children}
        </motion.div>
    );
}

// Staggered list animation
interface StaggerListProps {
    children: ReactNode[];
    staggerDelay?: number;
}

export function StaggerList({ children, staggerDelay = 0.05 }: StaggerListProps) {
    return (
        <>
            {children.map((child, index) => (
                <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{
                        opacity: 1,
                        y: 0,
                        transition: { delay: index * staggerDelay }
                    }}
                >
                    {child}
                </motion.div>
            ))}
        </>
    );
}