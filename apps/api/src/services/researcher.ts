import * as dns from "node:dns/promises";
import * as net from "node:net";
import * as cheerio from "cheerio";

const MAX_PAGE_BYTES = 1_000_000;
const MAX_PAGES = 6;
const REQUEST_TIMEOUT_MS = 10_000;

type ResearchPage = {
  url: string;
  title: string;
  text: string;
};

export type CompanyResearch = {
  pages: ResearchPage[];
  pagesUsed: string[];
  gaps: string[];
};

function isPrivateIp(address: string): boolean {
  if (net.isIPv4(address)) {
    const [a, b] = address.split(".").map(Number);

    return (
      a === 10 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a === 127 ||
      (a === 169 && b === 254)
    );
  }

  if (net.isIPv6(address)) {
    const normalized = address.toLowerCase();

    return (
      normalized === "::1" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      normalized.startsWith("fe80:")
    );
  }

  return true;
}

async function validateUrl(input: string): Promise<URL> {
  let url: URL;

  try {
    url = new URL(input);
  } catch {
    throw new Error("Company URL is invalid.");
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Company URL must use HTTP or HTTPS.");
  }

  if (url.username || url.password) {
    throw new Error("Company URL must not contain credentials.");
  }

  const hostname = url.hostname.toLowerCase();

  const isProduction = process.env.NODE_ENV === "production";
  const isLocalhost =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1";

  if (isProduction && isLocalhost) {
    throw new Error("Private or loopback company URLs are not allowed.");
  }

  if (net.isIP(hostname)) {
    if (isProduction && isPrivateIp(hostname)) {
      throw new Error("Private or loopback company URLs are not allowed.");
    }

    return url;
  }

  try {
    const addresses = await dns.lookup(hostname, {
      all: true,
      verbatim: true,
    });

    if (
      isProduction &&
      addresses.some((entry) => isPrivateIp(entry.address))
    ) {
      throw new Error("Company URL resolves to a private address.");
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("private address")) {
      throw error;
    }

    throw new Error("Company hostname could not be resolved.");
  }

  return url;
}

async function fetchPage(url: URL): Promise<{
  page: ResearchPage;
  links: Array<{ href: string; text: string }>;
}> {
  const MAX_REDIRECTS = 3;

  let currentUrl = url;

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount++) {
    const validatedUrl = await validateUrl(currentUrl.href);

    const controller = new AbortController();

    const timeout = setTimeout(() => {
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(validatedUrl, {
        signal: controller.signal,
        headers: {
          Accept: "text/html,application/xhtml+xml",
          "User-Agent": "AI-Interview-Prep/1.0",
        },
        redirect: "manual",
      });

      if (
        response.status >= 300 &&
        response.status < 400 &&
        response.headers.get("location")
      ) {
        if (redirectCount === MAX_REDIRECTS) {
          throw new Error("Too many redirects.");
        }

        const redirectUrl = new URL(
          response.headers.get("location")!,
          validatedUrl
        );

        currentUrl = redirectUrl;
        continue;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const contentType = response.headers.get("content-type") ?? "";

      if (!contentType.includes("text/html")) {
        throw new Error("Unsupported content type.");
      }

      const contentLength = response.headers.get("content-length");

      if (
        contentLength &&
        Number.parseInt(contentLength, 10) > MAX_PAGE_BYTES
      ) {
        throw new Error("Page exceeds the maximum allowed size.");
      }

      const buffer = await response.arrayBuffer();

      if (buffer.byteLength > MAX_PAGE_BYTES) {
        throw new Error("Page exceeds the maximum allowed size.");
      }

      const html = new TextDecoder().decode(buffer);
      const $ = cheerio.load(html);

      $(
        "script, style, noscript, svg, nav, footer, header, form, " +
        "[role='navigation'], [role='dialog'], [aria-hidden='true']"
      ).remove();

      const title = $("title").first().text().trim();

      const contentRoot =
        $("main").first().length > 0
          ? $("main").first()
          : $("article").first().length > 0
            ? $("article").first()
            : $("body");

      const text = contentRoot
        .text()
        .replace(/\s+/g, " ")
        .trim();

      const links = $("a[href]")
        .map((_, element) => ({
          href: $(element).attr("href") ?? "",
          text: $(element).text().replace(/\s+/g, " ").trim(),
        }))
        .get();

      return {
        page: {
          url: validatedUrl.href,
          title,
          text: text.slice(0, 20_000),
        },
        links,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error("Unable to retrieve page.");
}

function rankLink(link: { url: URL; text: string }): number {
  const value = `${link.url.pathname} ${link.text}`.toLowerCase();

  let score = 0;

  const keywords = [
    ["about", 10],
    ["company", 8],
    ["career", 10],
    ["careers", 10],
    ["job", 9],
    ["jobs", 9],
    ["hiring", 12],
    ["work-with-us", 12],
    ["join-us", 12],
    ["interview", 8],
    ["engineering", 6],
    ["team", 4],
    ["culture", 5],
  ] as const;

  for (const [keyword, points] of keywords) {
    if (value.includes(keyword)) {
      score += points;
    }
  }

  return score;
}

function getSameOriginLinks(
  baseUrl: URL,
  links: Array<{ href: string; text: string }>
): Array<{ url: URL; text: string; score: number }> {
  const unique = new Map<string, { url: URL; text: string; score: number }>();

  for (const link of links) {
    if (!link.href) {
      continue;
    }

    try {
      const url = new URL(link.href, baseUrl);

      if (!["http:", "https:"].includes(url.protocol)) {
        continue;
      }

      if (url.origin !== baseUrl.origin) {
        continue;
      }

      url.hash = "";

      const key = url.href;

      if (key === baseUrl.href || unique.has(key)) {
        continue;
      }

      unique.set(key, {
        url,
        text: link.text,
        score: rankLink({ url, text: link.text }),
      });
    } catch {
      continue;
    }
  }

  return [...unique.values()].sort((a, b) => b.score - a.score);
}

export async function researchCompany(
  companyUrl: string
): Promise<CompanyResearch> {
  const validatedUrl = await validateUrl(companyUrl);

  const pages: ResearchPage[] = [];
  const gaps: string[] = [];
  const visited = new Set<string>();

  try {
    const homepage = await fetchPage(validatedUrl);

    pages.push(homepage.page);
    visited.add(homepage.page.url);

    const links = getSameOriginLinks(validatedUrl, homepage.links);

    for (const link of links.slice(0, MAX_PAGES - 1)) {
      if (pages.length >= MAX_PAGES) {
        break;
      }

      try {
        const page = await fetchPage(link.url);

        if (!visited.has(page.page.url)) {
          pages.push(page.page);
          visited.add(page.page.url);
        }
      } catch {
        gaps.push(`Could not retrieve ${link.url.href}`);
      }
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown retrieval error.";

    gaps.push(`Could not retrieve company site: ${message}`);
  }

  if (pages.length === 0) {
    throw new Error("Company site could not be retrieved.");
  }

  if (pages.length === 1) {
    gaps.push("No additional useful company pages were retrieved.");
  }

  return {
    pages,
    pagesUsed: pages.map((page) => page.url),
    gaps,
  };
}