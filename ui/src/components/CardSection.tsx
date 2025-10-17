import type { HTMLAttributes, ReactNode } from "react";
import { classNames } from "../utils/classNames";

interface CardSectionProps extends HTMLAttributes<HTMLElement> {
  title?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function CardSection({
  title,
  className,
  actions,
  children,
  ...rest
}: CardSectionProps): JSX.Element {
  const hasHeader = Boolean(title) || Boolean(actions);

  return (
    <section className={classNames("card-section", className)} {...rest}>
      {hasHeader && (
        <div className="card-section-header">
          {title ? <h3 className="card-section-title">{title}</h3> : null}
          {actions ? <div className="card-section-actions">{actions}</div> : null}
        </div>
      )}
      {children}
    </section>
  );
}
