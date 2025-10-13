import type { SVGProps } from "react";

export function CheckIcon(props: SVGProps<SVGSVGElement>): JSX.Element {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" focusable="false" {...props}>
      <path d="M6.25 12.25 2.5 8.5l1.41-1.41 2.34 2.33 5.34-5.34 1.41 1.42-6.75 6.75Z" />
    </svg>
  );
}

