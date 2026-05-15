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

const PptWorkspace = memo(() => {
  const containerRef = useRef<HTMLDivElement>(null);
  const uiRef = useRef<{ destroy?: () => void } | null>(null);
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

    const mount = async () => {
      try {
        setErrorCode(undefined);
        const token = await createToken();
        if (disposed || !containerRef.current || !token?.token) return;

        const { DocmeeUI } = await import('@docmee/sdk-ui');
        uiRef.current = new DocmeeUI({
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
      } catch (error: any) {
        setErrorCode(error?.message || 'PPT_UPSTREAM_TOKEN_FAILED');
      }
    };

    mount();

    return () => {
      disposed = true;
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
