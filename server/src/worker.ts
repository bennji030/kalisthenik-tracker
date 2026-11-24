import { handle } from './handler';
import { kvStore, type KVNamespace } from './store';

interface Env {
  TOKEN?: string;
  DAYS: KVNamespace;
}

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return handle(request, { token: env.TOKEN, store: kvStore(env.DAYS) });
  },
};
