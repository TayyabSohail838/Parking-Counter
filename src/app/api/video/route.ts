/**
 * Same-origin video proxy: GET /api/video?url=<direct link to a video file>
 *
 * Why: the counter reads pixels from the video to run detection. Browsers
 * block that for videos from other sites unless the site sends CORS headers
 * (most don't), and this app's COEP header blocks such videos outright.
 * Streaming the file through our own origin avoids both.
 *
 * Safety (this fetches URLs on the server, so guard against SSRF):
 *  - http(s) only, ports 80/443 only
 *  - the host must resolve to public addresses (no localhost / private ranges),
 *    checked again on every redirect
 *  - only video responses are passed through, up to MAX_BYTES
 */
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const MAX_BYTES = 500 * 1024 * 1024;
const MAX_REDIRECTS = 4;
const CONNECT_TIMEOUT_MS = 15_000;

function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const v6 = ip.toLowerCase();
  if (v6.startsWith("::ffff:")) return isPrivateAddress(v6.slice(7));
  return v6 === "::" || v6 === "::1" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe80");
}

async function checkUrl(raw: string): Promise<URL> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new ProxyError(400, "That isn't a valid link.");
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") throw new ProxyError(400, "Only http:// and https:// links are supported.");
  if (u.port && u.port !== "80" && u.port !== "443") throw new ProxyError(400, "Links on unusual ports aren't allowed.");
  if (u.username || u.password) throw new ProxyError(400, "Links with a username or password aren't allowed.");
  const host = u.hostname.replace(/^\[|\]$/g, "");
  const addrs = isIP(host) ? [host] : (await lookup(host, { all: true }).catch(() => [])).map((a) => a.address);
  if (!addrs.length) throw new ProxyError(400, "Couldn't find that website.");
  if (addrs.some(isPrivateAddress)) throw new ProxyError(400, "Links to local or private network addresses aren't allowed.");
  return u;
}

class ProxyError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

const fail = (status: number, error: string) =>
  Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });

export async function GET(request: Request) {
  const target = new URL(request.url).searchParams.get("url");
  if (!target) return fail(400, "Add a video link: /api/video?url=…");

  const range = request.headers.get("range");
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), CONNECT_TIMEOUT_MS);
  // Stop downloading if the browser goes away (closed tab, new source).
  request.signal.addEventListener("abort", () => timeout.abort());

  try {
    let url = await checkUrl(target);
    let res: Response | null = null;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      res = await fetch(url, {
        redirect: "manual",
        signal: timeout.signal,
        headers: { ...(range ? { Range: range } : {}), "User-Agent": "Mozilla/5.0 (compatible; ParkingCounter/1.0)" },
      });
      const next = res.status >= 300 && res.status < 400 ? res.headers.get("location") : null;
      if (!next) break;
      await res.body?.cancel();
      url = await checkUrl(new URL(next, url).toString());
      if (hop === MAX_REDIRECTS) throw new ProxyError(502, "That link redirects too many times.");
    }
    clearTimeout(timer); // connected - let the stream run as long as it needs
    if (!res) throw new ProxyError(502, "No response from that website.");

    if (!res.ok) {
      await res.body?.cancel();
      throw new ProxyError(502, `The website answered ${res.status}. The link may be private or expired.`);
    }
    const type = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    const isVideo = type.startsWith("video/") || (type === "application/octet-stream" && /\.(mp4|webm|mov|m4v|ogv)$/i.test(url.pathname));
    if (!isVideo) {
      await res.body?.cancel();
      throw new ProxyError(415, type.startsWith("text/html")
        ? "That link is a web page, not a video file. Use a direct link that ends in .mp4 or .webm (YouTube links won't work)."
        : `That link isn't a video (it's ${type || "an unknown type"}).`);
    }
    const total = Number(res.headers.get("content-range")?.split("/")[1] ?? res.headers.get("content-length") ?? 0);
    if (total > MAX_BYTES) {
      await res.body?.cancel();
      throw new ProxyError(413, "That video is larger than 500 MB.");
    }

    const headers = new Headers({
      "Content-Type": type === "application/octet-stream" ? "video/mp4" : type,
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    });
    for (const h of ["content-length", "content-range"]) {
      const v = res.headers.get(h);
      if (v) headers.set(h, v);
    }
    return new Response(res.body, { status: res.status, headers });
  } catch (e) {
    clearTimeout(timer);
    if (e instanceof ProxyError) return fail(e.status, e.message);
    if (timeout.signal.aborted) return fail(504, "That website took too long to answer.");
    return fail(502, "Couldn't load that video.");
  }
}
