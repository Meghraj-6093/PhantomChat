import type { ReactNode } from "react";
import { motion } from "framer-motion";

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <motion.div
      className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/15 text-primary-soft [&>svg]:h-8 [&>svg]:w-8">
        {icon}
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      {description && <p className="max-w-xs text-sm text-muted">{description}</p>}
      {action}
    </motion.div>
  );
}
