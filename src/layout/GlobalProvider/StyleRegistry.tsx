'use client';

import { useServerInsertedHTML } from 'next/navigation';
import { type PropsWithChildren } from 'react';

// @lobehub/ui v6 ships static CSS and injects it itself, so no antd-style
// StyleProvider is needed here — this registry only carries the fork's body
// background for the Next.js auth document.
const StyleRegistry = ({ children }: PropsWithChildren) => {
  useServerInsertedHTML(() => {
    return (
      <style
        dangerouslySetInnerHTML={{
          __html: `
              html body {background: #f8f8f8;}
              html[data-theme="dark"] body { background-color: #000; }
            `,
        }}
      />
    );
  });

  return <>{children}</>;
};

export default StyleRegistry;
