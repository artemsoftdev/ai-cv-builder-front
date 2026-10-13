const ALLOWED_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);

/**
 * Turns an untrusted URL (CV content is LLM output or user input) into something safe to put
 * in `href`, or null. Blocks `javascript:`/`data:` and friends; bare domains such as
 * "github.com/jane" get `https://`.
 */
export function safeHref(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  const withProtocol = /^[a-z][a-z\d+.-]*:/i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(withProtocol);
    return ALLOWED_PROTOCOLS.has(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}
