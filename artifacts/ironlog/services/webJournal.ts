/** The slice of the expo-sqlite connection (`db.$client`) this needs. */
export type JournalClient = {
  execAsync(sql: string): Promise<void>;
};

/**
 * Keep the rollback journal file allocated between transactions (web).
 *
 * With the default DELETE mode the OPFS access-handle pool truncates the
 * journal after every commit, so the first write of the next transaction has
 * to grow the file again. On iOS that growing write stalls while the main
 * thread blocks on the worker's sync reply, and every sync call behind it
 * times out. PERSIST only zeroes the journal header on commit, so the file
 * keeps its size and stays crash-safe (unlike MEMORY or OFF).
 */
export async function enablePersistentJournal(client: JournalClient): Promise<void> {
  await client.execAsync("PRAGMA journal_mode = PERSIST");
}
