import {
  isModuleAppBridgeEvent,
  isModuleAppBridgeLaunch,
  isModuleAppBridgeResponse,
  MODULE_APP_BRIDGE_CHANNEL,
  type ModuleAppBridgeLaunch,
  type ModuleAppBridgeRequest,
} from './bridge';

type ModuleAppSdkEvent = 'navigation' | 'progress';
type ModuleAppSdkListener = (payload: unknown) => void;

type MessageEventTarget = {
  addEventListener: (type: 'message', listener: (event: MessageEvent) => void) => void;
  removeEventListener: (type: 'message', listener: (event: MessageEvent) => void) => void;
};

type MessageTarget = {
  postMessage: (message: unknown, targetOrigin: string) => void;
};

type ModuleAppSdkOptions = {
  eventTarget?: MessageEventTarget;
  nonce: string;
  parentWindow?: MessageTarget;
  randomId?: () => string;
  requestTimeoutMs?: number;
  runtimeOrigin: string;
};

type ModuleAppLaunchOptions = {
  eventTarget?: MessageEventTarget;
  nonce: string;
  parentWindow?: MessageTarget;
  timeoutMs?: number;
};

type PendingRequest = {
  reject: (error: Error) => void;
  resolve: (value: unknown) => void;
  timeout: ReturnType<typeof setTimeout>;
};

export class ModuleAppSdkError extends Error {
  constructor(public readonly code: string, message = code) {
    super(message);
    this.name = 'ModuleAppSdkError';
  }
}

export interface ModuleAppSdk {
  context: <T extends Record<string, unknown> = Record<string, unknown>>() => Promise<T>;
  dispose: () => void;
  invoke: <T = unknown>(method: string, input?: unknown) => Promise<T>;
  on: (event: ModuleAppSdkEvent, listener: ModuleAppSdkListener) => () => void;
}

export const waitForModuleAppLaunch = (
  options: ModuleAppLaunchOptions,
): Promise<ModuleAppBridgeLaunch> => {
  if (options.nonce.length < 16) {
    return Promise.reject(new ModuleAppSdkError('MODULE_APP_SDK_NONCE_INVALID'));
  }

  const eventTarget: MessageEventTarget =
    options.eventTarget ?? (window as unknown as MessageEventTarget);
  const parentWindow: MessageTarget =
    options.parentWindow ?? (window.parent as unknown as MessageTarget);

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timeout);
      eventTarget.removeEventListener('message', onMessage);
    };
    const onMessage = (event: MessageEvent) => {
      if (
        event.source !== parentWindow ||
        !isModuleAppBridgeLaunch(event.data) ||
        event.data.nonce !== options.nonce
      ) {
        return;
      }

      let hostOrigin: string;
      try {
        hostOrigin = new URL(event.data.hostOrigin).origin;
      } catch {
        return;
      }
      if (event.origin !== hostOrigin) return;

      cleanup();
      resolve(event.data);
    };
    const timeout = setTimeout(() => {
      cleanup();
      reject(new ModuleAppSdkError('MODULE_APP_SDK_LAUNCH_TIMEOUT'));
    }, options.timeoutMs ?? 30_000);

    eventTarget.addEventListener('message', onMessage);
    parentWindow.postMessage(
      { channel: MODULE_APP_BRIDGE_CHANNEL, nonce: options.nonce, type: 'ready' },
      '*',
    );
  });
};

export const createModuleAppSdk = (options: ModuleAppSdkOptions): ModuleAppSdk => {
  if (options.nonce.length < 16) throw new ModuleAppSdkError('MODULE_APP_SDK_NONCE_INVALID');

  const runtimeOrigin = new URL(options.runtimeOrigin).origin;
  const eventTarget: MessageEventTarget =
    options.eventTarget ?? (window as unknown as MessageEventTarget);
  const parentWindow: MessageTarget =
    options.parentWindow ?? (window.parent as unknown as MessageTarget);
  const randomId = options.randomId ?? (() => crypto.randomUUID());
  const requestTimeoutMs = options.requestTimeoutMs ?? 30_000;
  const pending = new Map<string, PendingRequest>();
  const listeners = new Map<ModuleAppSdkEvent, Set<ModuleAppSdkListener>>();
  let disposed = false;

  const onMessage = (event: MessageEvent) => {
    if (
      disposed ||
      event.origin !== runtimeOrigin ||
      event.source !== parentWindow
    ) {
      return;
    }

    if (isModuleAppBridgeResponse(event.data) && event.data.nonce === options.nonce) {
      const request = pending.get(event.data.id);
      if (!request) return;

      clearTimeout(request.timeout);
      pending.delete(event.data.id);
      if (event.data.ok) {
        request.resolve(event.data.result);
      } else {
        request.reject(
          new ModuleAppSdkError(
            event.data.error?.code ?? 'MODULE_APP_SDK_REQUEST_FAILED',
            event.data.error?.message,
          ),
        );
      }
      return;
    }

    if (isModuleAppBridgeEvent(event.data) && event.data.nonce === options.nonce) {
      for (const listener of listeners.get(event.data.event) ?? []) listener(event.data.payload);
    }
  };

  eventTarget.addEventListener('message', onMessage);

  const invoke = <T = unknown>(method: string, input?: unknown): Promise<T> => {
    if (disposed) return Promise.reject(new ModuleAppSdkError('MODULE_APP_SDK_DISPOSED'));
    if (!method || method.length > 120) {
      return Promise.reject(new ModuleAppSdkError('MODULE_APP_SDK_METHOD_INVALID'));
    }

    const id = randomId();
    const message: ModuleAppBridgeRequest = {
      channel: MODULE_APP_BRIDGE_CHANNEL,
      id,
      input,
      method,
      nonce: options.nonce,
      type: 'request',
    };

    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        pending.delete(id);
        reject(new ModuleAppSdkError('MODULE_APP_SDK_TIMEOUT'));
      }, requestTimeoutMs);
      pending.set(id, {
        reject,
        resolve: resolve as (value: unknown) => void,
        timeout,
      });
      parentWindow.postMessage(message, runtimeOrigin);
    });
  };

  return {
    context: <T extends Record<string, unknown> = Record<string, unknown>>() =>
      invoke<T>('context.get'),
    dispose: () => {
      if (disposed) return;
      disposed = true;
      eventTarget.removeEventListener('message', onMessage);
      for (const request of pending.values()) {
        clearTimeout(request.timeout);
        request.reject(new ModuleAppSdkError('MODULE_APP_SDK_DISPOSED'));
      }
      pending.clear();
      listeners.clear();
    },
    invoke,
    on: (event, listener) => {
      const eventListeners = listeners.get(event) ?? new Set<ModuleAppSdkListener>();
      eventListeners.add(listener);
      listeners.set(event, eventListeners);

      return () => eventListeners.delete(listener);
    },
  };
};
