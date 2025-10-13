import type { ReactNode } from "react";
import { classNames } from "../utils/classNames";

interface CardSectionProps {
  title?: string;
  className?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function CardSection({ title, className, actions, children }: CardSectionProps): JSX.Element {
  const hasHeader = Boolean(title) || Boolean(actions);

  return (
    <section className={classNames("card-section", className)}>
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

