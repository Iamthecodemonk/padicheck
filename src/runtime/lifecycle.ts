export async function deadline<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([operation, new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error('Operation deadline exceeded')), timeoutMs);
    })]);
  } finally { if (timer) clearTimeout(timer); }
}

type CloseStep = { name: string; close(): Promise<unknown> };
export function gracefulShutdown(options: {
  timeoutMs: number; steps: CloseStep[]; onError(name: string): void;
  forceExit?: () => void;
}) {
  let closing: Promise<void> | undefined;
  return () => {
    closing ??= (async () => {
      const timer = setTimeout(options.forceExit ?? (() => process.exit(1)), options.timeoutMs);
      timer.unref();
      try {
        for (const step of options.steps) {
          try { await step.close(); } catch { options.onError(step.name); }
        }
      } finally { clearTimeout(timer); }
    })();
    return closing;
  };
}
