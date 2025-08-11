import { URL } from 'url';

export function validateUrl(input: string): boolean | string {
  if (!input || input.trim().length === 0) {
    return 'Please enter a URL.';
  }

  const trimmed = input.trim();

  // Accept explicit http/https URLs
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return 'URL must use http:// or https:// protocol.';
      }
      return true;
    } catch {
      return 'Please enter a valid URL (e.g., https://example.com).';
    }
  }

  // Allow protocol-less inputs by attempting to parse as https
  try {
    // This will throw if the domain/path is malformed
    // We only validate shape here; actual reachability is tested later
    // when resolving candidates.
    // eslint-disable-next-line no-new
    new URL(`https://${trimmed}`);
    return true;
  } catch {
    return 'Please enter a valid URL or domain (e.g., example.com or https://example.com).';
  }
}

export function sanitizePageName(url: string): string {
  try {
    const urlObj = new URL(url);
    let pathname = urlObj.pathname;
    
    // Remove leading/trailing slashes and replace with meaningful names
    if (pathname === '/' || pathname === '') {
      return 'index';
    }
    
    // Remove leading slash and replace subsequent slashes with hyphens
    pathname = pathname.replace(/^\//, '').replace(/\//g, '-');
    
    // Remove file extensions
    pathname = pathname.replace(/\.[^.]*$/, '');
    
    // Replace special characters with hyphens
    pathname = pathname.replace(/[^a-zA-Z0-9-_]/g, '-');
    
    // Remove consecutive hyphens
    pathname = pathname.replace(/-+/g, '-');
    
    // Remove leading/trailing hyphens
    pathname = pathname.replace(/^-|-$/g, '');
    
    return pathname || 'index';
  } catch (error) {
    return 'invalid-url';
  }
}

/**
 * Build candidate URLs to try, in the required order.
 * If the input already includes protocol, returns it as the sole candidate.
 */
export function buildCandidateUrls(input: string): string[] {
  const trimmed = input.trim();

  if (/^https?:\/\//i.test(trimmed)) {
    return [trimmed];
  }

  // Parse as https first to normalize host/path
  let httpsParsed: URL;
  try {
    httpsParsed = new URL(`https://${trimmed}`);
  } catch {
    // If cannot parse, just return a best-effort https variant
    return [`https://${trimmed}`];
  }

  const host = httpsParsed.host; // includes port if any, but protocol-less inputs shouldn't have one
  const pathAndQuery = `${httpsParsed.pathname || ''}${httpsParsed.search || ''}${httpsParsed.hash || ''}`;

  const withWww = host.startsWith('www.') ? host : `www.${host}`;

  return [
    `https://${host}${pathAndQuery}`,
    `https://${withWww}${pathAndQuery}`,
    `http://${host}${pathAndQuery}`,
    `http://${withWww}${pathAndQuery}`
  ];
}

/**
 * Attempt to resolve the best working URL by probing candidates in order.
 * If input already includes protocol, it is returned as-is without probing.
 */
export async function resolveUrlByProbing(input: string, timeoutMs: number = 5000): Promise<string> {
  const candidates = buildCandidateUrls(input);

  // If user provided explicit protocol, do not probe alternatives
  if (candidates.length === 1 && /^https?:\/\//i.test(candidates[0])) {
    return candidates[0];
  }

  for (const candidate of candidates) {
    const ok = await probeUrl(candidate, timeoutMs);
    if (ok) return candidate;
  }

  // If none succeeded, return the first candidate (https) as default
  return candidates[0];
}

async function probeUrl(urlString: string, timeoutMs: number): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    // Try HEAD first to minimize data transfer
    let response = await fetch(urlString, {
      method: 'HEAD',
      redirect: 'follow',
      signal: controller.signal
    } as RequestInit);

    // Some servers do not support HEAD; fall back to GET on 405/501
    if (response.status === 405 || response.status === 501) {
      response = await fetch(urlString, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal
      } as RequestInit);
    }

    clearTimeout(timer);
    return response.ok || (response.status >= 200 && response.status < 400);
  } catch {
    return false;
  }
}