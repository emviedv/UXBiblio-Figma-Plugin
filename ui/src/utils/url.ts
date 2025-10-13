export function formatEndpoint(endpoint: string): string {
  try {
    const url = new URL(endpoint);
    const path = url.pathname.replace(/\/$/, "");
    return `${url.origin}${path}`;
  } catch {
    return endpoint;
  }
}

