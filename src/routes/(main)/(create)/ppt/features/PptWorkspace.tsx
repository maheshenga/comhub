'use client';

import { Spin } from 'antd';
import { memo, useEffect, useRef, useState } from 'react';
import useSWR from 'swr';

import { docmeeService } from '@/services/docmee';

import PptErrorState from './PptErrorState';
import { useDocmeeToken } from './useDocmeeToken';

const getDownloadButton = (runtime: any) => {
  const formats = [
    runtime?.allowPptxDownload ? 'pptx' : null,
    runtime?.allowPdfExport ? 'pdf' : null,
  ].filter(Boolean);

  return formats.length > 0 ? formats : false;
};

const getUpstreamTaskId = (data: any) =>
  data?.id || data?.taskId || data?.pptId || data?.pptInfo?.id;

const getDocmeeErrorCode = (error: any) =>
  error?.code ||
  error?.data?.code ||
  error?.data?.message ||
  error?.message ||
  'PPT_UPSTREAM_TOKEN_FAILED';

const PptWorkspace = memo(() => {
  const containerRef = useRef<HTMLDivElement>(null);
  const uiRef = useRef<{
    destroy?: () => void;
    on?: (eventName: string, callback: (message?: any) => void) => void;
  } | null>(null);
  const [errorCode, setErrorCode] = useState<string>();
  const [retryNonce, setRetryNonce] = useState(0);
  const {
    data: runtime,
    isLoading,
    mutate,
  } = useSWR(['docmee-ppt-runtime'], () => docmeeService.getPptRuntime());
  const { trigger: createToken } = useDocmeeToken();

  useEffect(() => {
    if (!runtime || !('enabled' in runtime) || runtime.enabled === false || !containerRef.current)
      return;

    let disposed = false;
    let mountTimeout: number | undefined;

    const mount = async () => {
      try {
        setErrorCode(undefined);
        const token = await createToken();
        if (disposed || !containerRef.current || !token?.token) return;

        const { DocmeeUI } = await import('@docmee/sdk-ui');
        if (disposed || !containerRef.current) return;

        const ui = new DocmeeUI({
          DOMAIN: runtime.baseUrl,
          container: containerRef.current,
          creatorVersion: runtime.creatorVersion,
          downloadButton: getDownloadButton(runtime) as any,
          lang: runtime.lang,
          mode: 'light',
          onMessage: async (event: any) => {
            if (!token?.sessionId) return;
            if (
              ['afterGenerate', 'beforeDownload', 'charge', 'error', 'pageChange'].includes(
                event.type,
              )
            ) {
              await docmeeService.reportPptEvent({
                data: event.data,
                sessionId: token.sessionId,
                type: event.type,
                upstreamTaskId: getUpstreamTaskId(event.data),
              });
            }
          },
          page: runtime.creatorVersion === 'v2' ? 'creator-v2' : 'creator',
          token: token.token,
        });
        uiRef.current = ui;

        let mounted = false;
        mountTimeout = window.setTimeout(() => {
          if (!disposed && !mounted) setErrorCode('PPT_UPSTREAM_TOKEN_FAILED');
        }, 15_000);

        ui.on?.('mounted', () => {
          mounted = true;
          window.clearTimeout(mountTimeout);
        });
        ui.on?.('invalid-token', () => {
          mounted = true;
          window.clearTimeout(mountTimeout);
          if (!disposed) setErrorCode('PPT_UPSTREAM_TOKEN_FAILED');
        });
        ui.on?.('error', (message: any) => {
          mounted = true;
          window.clearTimeout(mountTimeout);
          if (!disposed) setErrorCode(getDocmeeErrorCode(message));
        });
      } catch (error: any) {
        if (!disposed) setErrorCode(getDocmeeErrorCode(error));
      }
    };

    mount();

    return () => {
      disposed = true;
      if (mountTimeout) window.clearTimeout(mountTimeout);
      uiRef.current?.destroy?.();
      uiRef.current = null;
    };
  }, [createToken, runtime, retryNonce]);

  const handleRetry = () => {
    setErrorCode(undefined);
    setRetryNonce((value) => value + 1);
    mutate();
  };

  if (isLoading) return <Spin fullscreen description="正在加载 PPT 创作服务" />;
  if ((runtime as any)?.enabled === false) {
    return <PptErrorState code={(runtime as any)?.code} onRetry={handleRetry} />;
  }
  if (errorCode) return <PptErrorState code={errorCode} onRetry={handleRetry} />;

  return (
    <div
      ref={containerRef}
      style={{ height: '100%', minHeight: 'calc(100vh - 64px)', width: '100%' }}
    />
  );
});

PptWorkspace.displayName = 'PptWorkspace';

export default PptWorkspace;
