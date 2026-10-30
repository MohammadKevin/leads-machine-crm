import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function Card({ children, className = '', ...props }: CardProps) {
  return (
    <div
      className={`bg-white rounded-[12px] ring-1 ring-[#ECEAE2] shadow-[0_1px_2px_rgba(0,0,0,0.05)] ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

