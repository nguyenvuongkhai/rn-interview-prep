import { execute, type RunInput } from './execute';
import type { WorkerMessage } from './messages';

const post = (message: WorkerMessage) => self.postMessage(message);

self.onmessage = (event: MessageEvent<RunInput>) => {
  void execute(event.data, {
    onPlan: (tests) => post({ type: 'plan', tests }),
    onResult: (result) => post({ type: 'result', result }),
    onLog: (line) => post({ type: 'log', line }),
  }).then((output) => post({ type: 'done', output }));
};
