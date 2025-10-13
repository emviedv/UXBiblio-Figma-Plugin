import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { classNames } from "../utils/classNames";

type CollapsibleBodyElement = "div" | "ul" | "ol";

interface CollapsibleCardProps {
  title: string;
  children: ReactNode;
  icon?: LucideIcon;
  className?: string;
  bodyClassName?: string;
  bodyElement?: CollapsibleBodyElement;
}

export function CollapsibleCard(props: CollapsibleCardProps): JSX.Element {
  const { children, /* icon: Icon, */ className, bodyClassName, bodyElement = "div" } = props;
  const BodyComponent = bodyElement as CollapsibleBodyElement;

  return (
    <section className={classNames("card", className)} data-card-surface="true">
      <BodyComponent className={classNames("card-body", bodyClassName)}>{children}</BodyComponent>
    </section>
  );
}
