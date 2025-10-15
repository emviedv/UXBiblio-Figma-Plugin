export function formatKeyAsTitle(key: string): string {
  const spaced = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_\-\s]+/g, " ")
    .trim();

  if (!spaced) {
    return key;
  }

  return spaced
    .split(" ")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : ""))
    .join(" ")
    .trim();
}
