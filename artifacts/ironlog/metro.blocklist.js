// Pure helpers for `metro.config.js`, kept apart so they can be unit tested.

// Metro also watches the workspace root, and tools keep rewriting their
// folders there (the CodeGraph sqlite index, the agent registry): every write
// would trigger watcher churn. Matches the folder (and what is in it) at any depth, POSIX or
// Windows separators, and not look-alikes such as `.atlas` or `my.codegraph`.
const TOOL_DIR_BLOCK_PATTERNS = [/[\\/]\.codegraph([\\/]|$)/, /[\\/]\.atl([\\/]|$)/];

/**
 * Appends `extra` to Metro's `resolver.blockList` (a RegExp, an array of
 * RegExp or unset) without dropping what is already there.
 */
function mergeBlockList(existing, extra) {
  const current = existing == null ? [] : Array.isArray(existing) ? existing : [existing];
  const merged = [...current];
  for (const re of extra) {
    if (!merged.some((r) => String(r) === String(re))) merged.push(re);
  }
  return merged;
}

module.exports = { TOOL_DIR_BLOCK_PATTERNS, mergeBlockList };
