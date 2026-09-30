import { execute, type RunInput } from './execute';
import { errorMessage } from './harness';
import type { WorkerMessage } from './messages';

const post = (message: WorkerMessage) => self.postMessage(message);

// A throw from a stray real timer must not kill the run and lose the results so far.
self.addEventListener('error', (event) => {
  event.preventDefault();
  post({ type: 'log', line: `Uncaught: ${event.message}` });
});
self.addEventListener('unhandledrejection', (event) => {
  event.preventDefault();
  post({ type: 'log', line: `Unhandled rejection: ${errorMessage(event.reason)}` });
});

self.onmessage = (event: MessageEvent<RunInput>) => {
  void execute(event.data, {
    onPlan: (tests) => post({ type: 'plan', tests }),
    onResult: (result) => post({ type: 'result', result }),
    onLog: (line) => post({ type: 'log', line }),
  }).then((output) => post({ type: 'done', output }));
};
