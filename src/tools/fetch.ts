const MAX_BYTES = 100_000;

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function runFetchUrl(url: string): Promise<string> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return `Error: Invalid URL: ${url}`;
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return 'Error: Only http/https URLs are allowed';
  }

  try {
    const res = await fetch(url, {
      headers: { 'user-agent': 'Quak/1.0' },
      signal: AbortSignal.timeout(20_000),
    });
    const contentType = res.headers.get('content-type') ?? '';
    const body = await res.arrayBuffer();
    if (body.byteLength > MAX_BYTES) {
      return `Error: Response too large (${body.byteLength} bytes)`;
    }
    const text = new TextDecoder().decode(body);
    const plain = contentType.includes('html') ? stripHtml(text) : text;
    const trimmed = plain.slice(0, 12_000);
    return `URL: ${url}\nStatus: ${res.status}\n\n${trimmed}${plain.length > 12_000 ? '\n...(truncated)' : ''}`;
  } catch (error) {
    return `Fetch failed: ${error instanceof Error ? error.message : String(error)}`;
  }
}