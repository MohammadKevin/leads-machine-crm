import React from 'react';

export interface EmptyStateProps {
  title?: string;
  description: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  dashed?: boolean;
  className?: string;
}

export function EmptyState({
  title,
  description,
  action,
  icon,
  dashed = true,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center p-6 text-center select-none ${
        dashed ? 'rounded-[12px] border border-dashed border-[#DAD7CC] bg-white/40' : ''
      } ${className}`}
    >
      {icon && <div className="text-[#6B6A63] mb-2">{icon}</div>}
      {title && <h4 className="text-[14px] font-semibold text-[#1B1B18] mb-1">{title}</h4>}
      <p className="text-[13px] text-[#6B6A63] max-w-sm leading-relaxed">{description}</p>
      {action && <div className="mt-3.5">{action}</div>}
    </div>
  );
}

