import type { SVGProps } from "react";

export function CopyIcon(props: SVGProps<SVGSVGElement>): JSX.Element {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" focusable="false" {...props}>
      <path d="M6 2a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9a1 1 0 0 1 0-2h4V2H8v1a1 1 0 0 1-2 0V2ZM3 4h5a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm0 2v7h5V6H3Z" />
    </svg>
  );
}

