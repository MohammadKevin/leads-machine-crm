import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  children,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center font-medium transition-colors select-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B7A55]';

  const sizes = {
    sm: 'h-8 px-3 text-[13px] rounded-[8px] gap-1.5',
    md: 'h-9 px-3.5 text-[14px] rounded-[8px] gap-2',
    lg: 'h-10 px-4 text-[14px] rounded-[8px] gap-2',
  };

  const variants = {
    primary: 'bg-[#0B7A55] hover:bg-[#096345] text-white shadow-xs',
    secondary: 'bg-white hover:bg-[#F7F6F2] text-[#1B1B18] border border-[#DAD7CC]',
    outline: 'bg-transparent hover:bg-black/5 text-[#1B1B18] border border-[#DAD7CC]',
    danger: 'bg-[#FCE4E1] hover:bg-[#F9D0CA] text-[#B3261E] border border-[#F9D0CA]',
    ghost: 'bg-transparent hover:bg-black/5 text-[#6B6A63] hover:text-[#1B1B18]',
  };

  return (
    <button
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {icon && <span className="shrink-0 flex items-center justify-center">{icon}</span>}
      {children}
    </button>
  );
}

