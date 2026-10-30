import React from 'react';

export function Skeleton({
  className = '',
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`animate-pulse bg-[#ECEAE2] rounded-[8px] ${className}`}
      {...props}
    />
  );
}

export function PrototypeWireframeSkeleton({ device = 'mobile' }: { device?: 'mobile' | 'desktop' }) {
  if (device === 'desktop') {
    return (
      <div className="w-full max-w-[560px] mx-auto bg-white rounded-[12px] p-5 shadow-sm border border-[#ECEAE2] flex flex-col gap-4 animate-pulse">
        {/* Desktop navbar */}
        <div className="flex items-center justify-between pb-3 border-b border-[#F0EEE7]">
          <div className="w-24 h-4 bg-[#E0DED7] rounded-full" />
          <div className="flex gap-2">
            <div className="w-12 h-3 bg-[#ECEAE2] rounded-full" />
            <div className="w-12 h-3 bg-[#ECEAE2] rounded-full" />
            <div className="w-16 h-6 bg-[#C2E4D5] rounded-[6px]" />
          </div>
        </div>

        {/* Hero image */}
        <div className="w-full h-44 bg-[#E0DED7] rounded-[10px]" />

        {/* Headline & lines */}
        <div className="w-3/4 h-5 bg-[#E0DED7] rounded-md" />
        <div className="w-full h-3 bg-[#ECEAE2] rounded-md" />
        <div className="w-5/6 h-3 bg-[#ECEAE2] rounded-md" />

        {/* CTA */}
        <div className="w-40 h-8 bg-[#C2E4D5] rounded-[8px] mt-2" />
      </div>
    );
  }

  // Mobile Device Frame Skeleton (matching user screenshot)
  return (
    <div className="w-full max-w-[280px] sm:max-w-[320px] mx-auto bg-white rounded-[24px] p-4 shadow-sm border border-[#ECEAE2] flex flex-col gap-3.5 animate-pulse">
      {/* Hero Image Box */}
      <div className="w-full h-44 bg-[#E0DED7] rounded-[12px]" />

      {/* Title Bar */}
      <div className="w-2/3 h-4 bg-[#E0DED7] rounded-full" />

      {/* Subtitle / paragraph lines */}
      <div className="w-full h-3 bg-[#ECEAE2] rounded-full" />
      <div className="w-4/5 h-3 bg-[#ECEAE2] rounded-full" />

      {/* Green Action CTA button */}
      <div className="w-full h-10 bg-[#C2E4D5] rounded-[8px] mt-1" />
    </div>
  );
}

