import React from 'react';

export interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  count?: number | string;
  icon?: React.ReactNode;
}

export function Chip({
  active = false,
  count,
  icon,
  children,
  className = '',
  ...props
}: ChipProps) {
  return (
    <button
      type="button"
      className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[13px] font-medium transition-all select-none cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B7A55] ${
        active
          ? 'bg-[#1B1B18] text-white shadow-xs'
          : 'bg-white text-[#1B1B18] border border-[#DAD7CC] hover:bg-[#F7F6F2]'
      } ${className}`}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
      {count !== undefined && (
        <span
          className={`ml-0.5 text-[12px] font-normal tabular-nums ${
            active ? 'text-white/80' : 'text-[#6B6A63]'
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

