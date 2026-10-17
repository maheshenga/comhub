'use client';

import { Mermaid } from '@lobehub/ui';
import { Pre, PreSingleLine } from '@lobehub/ui/mdx';
import { type FC, type PropsWithChildren } from 'react';

const countLines = (str: string): number => {
  const regex = /\n/g;
  const matches = str.match(regex);
  return matches ? matches.length : 1;
};

const getCode = (raw: any) => {
  if (!raw) return;

  const { children, className } = raw.props;

  if (!children) return;

  const content = (Array.isArray(children) ? (children[0] as string) : children).trim();

  const lang = className?.replace('language-', '') || 'txt';

  const isSingleLine = countLines(content) <= 1 && content.length <= 32;

  return {
    content,
    isSingleLine,
    lang,
  };
};

const CodeBlock: FC<PropsWithChildren> = ({ children }) => {
  const code = getCode(children);

  if (!code) return;

  if (code.isSingleLine) return <PreSingleLine language={code.lang}>{code.content}</PreSingleLine>;
  if (code.lang === 'mermaid') {
    return <Mermaid variant={'borderless'}>{code.content}</Mermaid>;
  }
  return (
    <Pre fullFeatured allowChangeLanguage={false} language={code.lang}>
      {code.content}
    </Pre>
  );
};

export default CodeBlock;
