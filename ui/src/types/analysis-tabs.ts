import type { LucideIcon } from "lucide-react";

export type AnalysisTabDescriptor = {
  id: string;
  label: string;
  icon: LucideIcon;
  hasContent: boolean;
  render: () => JSX.Element | null;
  emptyMessage: string;
};

