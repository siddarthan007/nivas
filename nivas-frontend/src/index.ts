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
    "/api/*": async (req) => {
      const url = new URL(req.url);
      const backendUrl = `${BACKEND_URL}${url.pathname}${url.search}`;

      try {
        // Clone headers but remove host
        const headers = new Headers(req.headers);
        headers.delete("host");

        // Forward request to backend
        console.log(`[Proxy] ${req.method} ${url.pathname} -> ${backendUrl}`);

        let body;
        if (req.method !== "GET" && req.method !== "HEAD") {
          body = await req.arrayBuffer();
        }

        const response = await fetch(backendUrl, {
          method: req.method,
          headers,
          body,
        });

        console.log(`[Proxy] Response: ${response.status} ${response.statusText}`);

        // Clone response with CORS headers for frontend
        // Use getSetCookie() to properly preserve multiple Set-Cookie headers
        // (the Headers constructor can incorrectly merge them)
        const responseHeaders = new Headers(response.headers);
        responseHeaders.set("Access-Control-Allow-Origin", "*");

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

console.log(`
╔═══════════════════════════════════════════════════╗
║           🏨 NIVAS PMS Frontend                   ║
╠═══════════════════════════════════════════════════╣
║  Frontend:  ${server.url}                    ║
║  Backend:   ${BACKEND_URL}               ║
║  Mode:      ${process.env.NODE_ENV || "development"}                       ║
╚═══════════════════════════════════════════════════╝
`);
