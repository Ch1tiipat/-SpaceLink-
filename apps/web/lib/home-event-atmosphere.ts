export function filterUsableAtmosphereUrls(
  urls: readonly string[],
  failedUrls: ReadonlySet<string>,
): string[] {
  const seen = new Set<string>();

  return urls.filter((url) => {
    if (!url || failedUrls.has(url) || seen.has(url)) return false;
    seen.add(url);
    return true;
  });
}
