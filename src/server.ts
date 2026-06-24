import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

const DEFAULT_PUBLIC_HOSTS = ["punjab-case-management.live", "www.punjab-case-management.live"];
const DEFAULT_ADMIN_HOSTS = ["admin.punjab-case-management.live"];
const DEPLOYMENT_MARKER = "24JUN-006";

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function readRuntimeEnv(env: unknown, key: string) {
  if (env && typeof env === "object" && key in env) {
    const value = (env as Record<string, unknown>)[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return process.env[key]?.trim();
}

function readHostList(env: unknown, key: string, fallback: string[]) {
  const raw = readRuntimeEnv(env, key);
  return new Set(
    (raw ? raw.split(",") : fallback)
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean),
  );
}

function hostWithoutPort(request: Request) {
  return (request.headers.get("x-forwarded-host") || request.headers.get("host") || "")
    .split(",")[0]
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "");
}

function domainGate(request: Request, env: unknown) {
  const url = new URL(request.url);
  const host = hostWithoutPort(request);
  const surface = readRuntimeEnv(env, "APP_SURFACE")?.toLowerCase() ?? "all";
  const publicHosts = readHostList(env, "PUBLIC_HOSTS", DEFAULT_PUBLIC_HOSTS);
  const adminHosts = readHostList(env, "ADMIN_HOSTS", DEFAULT_ADMIN_HOSTS);
  const adminPath = /^\/(?:admin(?:\/|$)|card\/admin(?:\/|$))/.test(url.pathname);
  const userPath = /^\/user(?:\/|$)/.test(url.pathname);
  const publicSurface = surface === "public" || publicHosts.has(host);
  const adminSurface = surface === "admin" || adminHosts.has(host);

  if (publicSurface && adminPath) {
    return new Response("Not found", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  if (adminSurface && url.pathname === "/") {
    return Response.redirect(new URL("/card/admin", url), 302);
  }

  if (adminSurface && userPath) {
    return new Response("Not found", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  return undefined;
}

function withDeploymentHeaders(request: Request, response: Response) {
  const url = new URL(request.url);
  const headers = new Headers(response.headers);
  headers.set("X-PCM-Build", DEPLOYMENT_MARKER);
  if (!url.pathname.startsWith("/assets/")) {
    headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    headers.set("Pragma", "no-cache");
    headers.set("Expires", "0");
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const gated = domainGate(request, env);
      if (gated) return withDeploymentHeaders(request, gated);

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return withDeploymentHeaders(request, await normalizeCatastrophicSsrResponse(response));
    } catch (error) {
      console.error(error);
      return withDeploymentHeaders(request, new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      }));
    }
  },
};
