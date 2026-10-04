import { ReactNode } from "react";
import { LucideIcon, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="page-description">{description}</p>
      </div>
      {action}
    </div>
  );
}
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  label,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: () => void;
  label?: string;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Icon size={28} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action && (
        <Button onClick={action}>
          <Plus />
          {label}
        </Button>
      )}
    </div>
  );
}
export function Metric({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: ReactNode;
  detail: string;
  icon: LucideIcon;
}) {
  return (
    <div className="metric panel">
      <div className="metric-label">
        {label}
        <Icon size={18} />
      </div>
      <strong>{value}</strong>
      <span>{detail}</span>
    </div>
  );
}
