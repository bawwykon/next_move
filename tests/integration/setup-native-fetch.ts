/**
 * The RN/whatwg-fetch polyfill installed by jest-expo renders `fetch` inert
 * in the node environment (mocked XMLHttpRequest → undefined status/text).
 * Restore a minimal real fetch for live-DB integration tests only (never
 * loaded by the app or CI unit tests). No @types/node: node modules are
 * required as untyped and chunks are read as strings.
 */
/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */
const http: any = require('node:http');
const https: any = require('node:https');

function materializeHeaders(headers: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  const candidate = headers as {
    forEach?: (callback: (value: string, key: string) => void) => void;
  };
  if (candidate && typeof candidate.forEach === 'function') {
    candidate.forEach((value, key) => {
      out[key.toLowerCase()] = value;
    });
  } else if (candidate) {
    for (const [key, value] of Object.entries(candidate)) {
      if (typeof value === 'string') {
        out[key.toLowerCase()] = value;
      }
    }
  }
  return out;
}

export function installNativeFetch() {
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const transport = url.protocol === 'https:' ? https : http;
    const body = init?.body;
    const headers = { 'content-type': 'application/json', ...materializeHeaders(init?.headers) };

    return new Promise<Response>((resolve, reject) => {
      const request = transport.request(
        url,
        {
          method: init?.method ?? 'GET',
          headers,
          signal: init?.signal,
        },
        (response: any) => {
          response.setEncoding('utf8');
          const chunks: string[] = [];
          response.on('data', (chunk: string) => chunks.push(chunk));
          response.on('end', () => {
            const text = chunks.join('');
            const status = response.statusCode ?? 0;
            const headerEntries = (response.rawHeaders ?? []) as string[];
            const responseHeaders: Record<string, string> = {};
            for (let index = 0; index + 1 < headerEntries.length; index += 2) {
              responseHeaders[String(headerEntries[index]).toLowerCase()] = String(
                headerEntries[index + 1],
              );
            }
            resolve({
              ok: status >= 200 && status < 300,
              status,
              statusText: response.statusMessage ?? '',
              headers: {
                get(name: string) {
                  return responseHeaders[name.toLowerCase()] ?? null;
                },
              },
              text: async () => text,
              json: async () => JSON.parse(text) as unknown,
            } as Response);
          });
        },
      );
      request.on('error', reject);
      if (body !== undefined && body !== null) {
        request.write(typeof body === 'string' ? body : JSON.stringify(body));
      }
      request.end();
    });
  }) as typeof fetch;
}
