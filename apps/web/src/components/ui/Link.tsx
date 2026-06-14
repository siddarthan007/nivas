import type { ReactNode, AnchorHTMLAttributes } from "react";
import { useRouter } from "@/lib/router";

interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
    href: string;
    children: ReactNode;
    prefetch?: boolean;
}

/**
 * Simple Link component that mimics Next.js Link behavior
 * Handles client-side navigation without full page reload
 */
export default function Link({
    href,
    children,
    onClick,
    prefetch: _prefetch = true,
    ...props
}: LinkProps) {
    const router = useRouter();

    const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
        // Allow default behavior for:
        // - External links
        // - Links opened in new tab (ctrl/cmd + click)
        // - Links with target="_blank"
        const isExternal = href.startsWith("http") || href.startsWith("//");
        const isNewTab = e.ctrlKey || e.metaKey || props.target === "_blank";

        if (!isExternal && !isNewTab) {
            e.preventDefault();
            router.push(href);
        }

        onClick?.(e);
    };

    return (
        <a href={href} onClick={handleClick} {...props}>
            {children}
        </a>
    );
}
