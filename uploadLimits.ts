// Keep browser checks and server-side upload signing on the same limit.
// 50 MiB per file (50 × 1024 × 1024 bytes).
export const MAX_FILE_MB = 50;
export const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;
