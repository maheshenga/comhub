import { Client, Receiver } from '@upstash/qstash';
import { Client as WorkflowClient } from '@upstash/workflow';
import debug from 'debug';

const log = debug('lobe-server:qstash');

const headers = {
  ...(process.env.VERCEL_AUTOMATION_BYPASS_SECRET && {
    'x-vercel-protection-bypass': process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
  }),
};

type QStashClient = InstanceType<typeof Client>;
type UpstashWorkflowClient = InstanceType<typeof WorkflowClient>;

let cachedQstashClient: QStashClient | undefined;
let cachedQstashClientToken: string | undefined;
let cachedWorkflowClient: UpstashWorkflowClient | undefined;
let cachedWorkflowClientToken: string | undefined;

export const isQstashTokenAvailable = () => Boolean(process.env.QSTASH_TOKEN?.trim());

const getQstashToken = () => {
  const token = process.env.QSTASH_TOKEN?.trim();

  if (!token) {
    throw new Error('QSTASH_TOKEN is required to use QStash clients.');
  }

  return token;
};

const getQstashClient = () => {
  const token = getQstashToken();

  if (!cachedQstashClient || cachedQstashClientToken !== token) {
    cachedQstashClient = new Client({
      headers,
      token,
    });
    cachedQstashClientToken = token;
  }

  return cachedQstashClient;
};

const getWorkflowClient = () => {
  const token = getQstashToken();

  if (!cachedWorkflowClient || cachedWorkflowClientToken !== token) {
    cachedWorkflowClient = new WorkflowClient({
      headers,
      token,
    });
    cachedWorkflowClientToken = token;
  }

  return cachedWorkflowClient;
};

const createLazyClient = <TClient extends object>(getClient: () => TClient): TClient =>
  new Proxy({} as TClient, {
    get(_target, property) {
      const client = getClient();
      const value = Reflect.get(client, property, client);

      return typeof value === 'function' ? value.bind(client) : value;
    },
    has(_target, property) {
      return property in getClient();
    },
    set(_target, property, value) {
      Reflect.set(getClient(), property, value);

      return true;
    },
  });

/**
 * QStash client with Vercel Deployment Protection bypass headers.
 * Use as `qstashClient` option in Upstash Workflow `serve()`.
 *
 * @see https://upstash.com/docs/workflow/troubleshooting/vercel
 */
export const qstashClient = createLazyClient<QStashClient>(getQstashClient);

/**
 * Workflow client with Vercel Deployment Protection bypass headers.
 * Use for triggering workflows via `workflowClient.trigger()`.
 */
export const workflowClient = createLazyClient<UpstashWorkflowClient>(getWorkflowClient);

/**
 * Verify QStash signature using Receiver.
 * Returns true if signing keys are not configured (verification skipped) or signature is valid.
 */
export async function verifyQStashSignature(request: Request, rawBody: string): Promise<boolean> {
  const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;

  if (!currentSigningKey || !nextSigningKey) {
    log('QStash signature verification disabled (no signing keys configured)');
    return false;
  }

  const signature = request.headers.get('Upstash-Signature');
  if (!signature) {
    log('Missing Upstash-Signature header');
    return false;
  }

  const receiver = new Receiver({ currentSigningKey, nextSigningKey });

  try {
    return await receiver.verify({ body: rawBody, signature });
  } catch (error) {
    log('QStash signature verification failed: %O', error);
    return false;
  }
}
