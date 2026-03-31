/**
 * Simple deterministic ID generator for photo groups and plans.
 * Uses a monotonic counter prefix + random suffix to guarantee uniqueness
 * within a session without requiring UUID library overhead.
 */

let counter = 0;

export function generateId(): string {
  counter += 1;
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 7);
  return `${ts}-${rand}-${counter}`;
}

export function resetIdCounter(): void {
  counter = 0;
}
