const API_BASE = "https://secure.splitwise.com/api/v3.0";

export async function splitwiseFetch<T>(
  path: string,
  accessToken: string,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Splitwise API ${path} failed: ${res.status} ${body.slice(0, 200)}`,
    );
  }
  return (await res.json()) as T;
}
