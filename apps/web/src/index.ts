import { serve } from "bun";
import index from "./index.html";

/**
 * Nivas PMS Frontend Server
 * - Serves React SPA for all frontend routes
 * - Proxies /api/* requests to backend (port 3000)
 * - Enables HMR in development
 */

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3000";

const server = serve({
  port: 5173,

  routes: {
    // ═══════════════════════════════════════════
    // API PROXY - Forward all /api/* to backend
    // ═══════════════════════════════════════════
    "/api/*": async (req, server) => {
      const url = new URL(req.url);
      const backendUrl = `${BACKEND_URL}${url.pathname}${url.search}`;

      try {
        // Clone headers but remove host
        const headers = new Headers(req.headers);
        headers.delete("host");

        // Forward the real client IP so backend rate-limiting keys per-client
        // (without this every request looks like it comes from the proxy).
        try {
          const clientIp = (server as any)?.requestIP?.(req)?.address;
          if (clientIp) {
            const existing = req.headers.get("x-forwarded-for");
            headers.set("x-forwarded-for", existing ? `${existing}, ${clientIp}` : clientIp);
            if (!req.headers.get("x-real-ip")) headers.set("x-real-ip", clientIp);
          }
        } catch { /* ip unavailable — backend falls back gracefully */ }

        // Forward request to backend

        let body;
        if (req.method !== "GET" && req.method !== "HEAD") {
          body = await req.arrayBuffer();
        }

        const response = await fetch(backendUrl, {
          method: req.method,
          headers,
          body,
        });

        // Clone response with CORS headers for frontend
        // Use getSetCookie() to properly preserve multiple Set-Cookie headers
        // (the Headers constructor can incorrectly merge them)
        const responseHeaders = new Headers(response.headers);
        // Do not override Access-Control-Allow-Origin; backend CORS config handles it properly

        const setCookies = response.headers.getSetCookie?.() ?? [];
        if (setCookies.length > 0) {
          responseHeaders.delete("set-cookie");
          for (const sc of setCookies) {
            responseHeaders.append("set-cookie", sc);
          }
        }

        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders,
        });
      } catch (error) {
        console.error(`[Proxy Error] ${req.method} ${url.pathname}:`, error);
        return Response.json(
          { error: "Backend unavailable", message: String(error) },
          { status: 502 }
        );
      }
    },

    // ═══════════════════════════════════════════
    // STATIC FILES - Serve public assets
    // ═══════════════════════════════════════════
    "/logo.svg": Bun.file("./src/logo.svg"),
    "/favicon.ico": Bun.file("./public/favicon.ico"),

    // ═══════════════════════════════════════════
    // SPA FALLBACK - Serve index.html for all routes
    // ═══════════════════════════════════════════
    "/*": index,
  },

  development: process.env.NODE_ENV !== "production" && {
    hmr: true,
    console: true,
  },
});
