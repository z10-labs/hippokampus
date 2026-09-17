/** Groups items by key, preserving first-seen key order and item order within each group. */
export function groupBy<T, K>(items: readonly T[], keyOf: (item: T) => K): Map<K, T[]> {
  const groups = new Map<K, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return groups;
}

export const directoryOf = (filePath: string): string => filePath.split("/").slice(0, -1).join("/");
export const baseNameOf = (filePath: string): string => filePath.split("/").pop() ?? filePath;
