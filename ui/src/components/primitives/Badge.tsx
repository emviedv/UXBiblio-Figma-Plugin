import type { HTMLAttributes, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { classNames } from "../../utils/classNames";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone: string;
  children: ReactNode;
  icon?: LucideIcon;
}

export function Badge({ tone, children, icon: Icon, className, ...rest }: BadgeProps): JSX.Element {
  return (
    <span
      className={classNames("badge", Icon && "badge-has-icon", className)}
      data-badge-tone={tone}
      {...rest}
    >
      {Icon ? <Icon className="badge-icon" aria-hidden="true" /> : null}
      <span className="badge-label">{children}</span>
    </span>
  );
}
