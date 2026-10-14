/** Compare dotted numeric versions. A leading `v` is ignored. Missing parts count as 0. */
export function compareVersions(left: string, right: string): number {
  const parse = (value: string) =>
    value
      .trim()
      .replace(/^v/i, "")
      .split(".")
      .map((part) => {
        const match = /^(\d+)/.exec(part);
        return match ? Number.parseInt(match[1], 10) : 0;
      });

  const a = parse(left);
  const b = parse(right);
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) return diff < 0 ? -1 : 1;
  }
  return 0;
}
