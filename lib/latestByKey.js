// Keeps the latest row per key — treatment_selections/simulations have no uniqueness
// constraint (a user can change their pick), so history is append-only.
export function latestByKey(rows, keyFn) {
  const byKey = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    const existing = byKey.get(key);
    if (!existing || new Date(row.created_at) > new Date(existing.created_at)) {
      byKey.set(key, row);
    }
  }
  return byKey;
}
