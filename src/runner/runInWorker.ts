import type { TestResult } from '../core/types';
import type { RunInput, RunOutput } from './execute';
import type { PlannedTest } from './harness';
import type { WorkerMessage } from './messages';
import { RUN_TIMEOUT_MS, finishTimedOut } from './timeouts';

/** Runs in a throwaway module worker so a hung or hostile solution cannot freeze the page. */
export function runInWorker(input: RunInput, signal?: AbortSignal): Promise<RunOutput> {
  return new Promise((resolve) => {
    const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    const planned: PlannedTest[] = [];
    const results: TestResult[] = [];
    const logs: string[] = [];
    const end = (output: RunOutput) => {
      window.clearTimeout(timer);
      worker.terminate();
      resolve(output);
    };
    const timer = window.setTimeout(
      () => end({ results: finishTimedOut(planned, results), logs, error: `Timeout after ${RUN_TIMEOUT_MS} ms` }),
      RUN_TIMEOUT_MS,
    );
    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const m = event.data;
      if (m.type === 'plan') planned.push(...m.tests);
      else if (m.type === 'result') results.push(m.result);
      else if (m.type === 'log') logs.push(m.line);
      else end(m.output);
    };
    worker.onerror = (event) => {
      if (planned.length > 0) {
        event.preventDefault();
        logs.push(`Uncaught: ${event.message}`);
        return;
      }
      end({ results: [], logs, error: event.message || 'The test runner failed to start' });
    };
    signal?.addEventListener('abort', () => end({ results, logs, error: 'Cancelled' }), { once: true });
    worker.postMessage(input);
  });
}
