import React from 'react';

export type BadgeVariant = 'antre' | 'mengirim' | 'hangat' | 'gagal' | 'sultan' | 'sukses' | 'default';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  children: React.ReactNode;
  icon?: React.ReactNode;
}

export function Badge({
  variant = 'default',
  children,
  icon,
  className = '',
  ...props
}: BadgeProps) {
  const variants: Record<BadgeVariant, string> = {
    antre: 'bg-[#ECEAE2] text-[#55544D]',
    mengirim: 'bg-[#FFF1D6] text-[#8A5300]',
    hangat: 'bg-[#FFF1D6] text-[#8A5300]',
    gagal: 'bg-[#FCE4E1] text-[#B3261E]',
    sultan: 'bg-[#E4F3EC] text-[#0B6B4A]',
    sukses: 'bg-[#E4F3EC] text-[#0B6B4A]',
    default: 'bg-[#ECEAE2] text-[#55544D]',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[12px] font-medium leading-none select-none tabular-nums ${variants[variant]} ${className}`}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </span>
  );
}

