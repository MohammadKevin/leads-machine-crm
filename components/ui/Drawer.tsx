import React, { useEffect } from 'react';

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
}

export function Drawer({ isOpen, onClose, title, subtitle, children }: DrawerProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/25 backdrop-blur-[2px] transition-opacity animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer content */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col border-l border-[#DAD7CC]">
          {/* Header */}
          <div className="px-6 py-4 border-b border-[#F0EEE7] flex items-center justify-between">
            <div className="min-w-0 pr-4">
              {title && (
                <h3 className="text-[16px] font-semibold text-[#1B1B18] truncate">
                  {title}
                </h3>
              )}
              {subtitle && (
                <p className="text-[13px] text-[#6B6A63] truncate mt-0.5">{subtitle}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup panel"
              className="w-8 h-8 rounded-[8px] flex items-center justify-center text-[#6B6A63] hover:text-[#1B1B18] hover:bg-[#F7F6F2] transition cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5">{children}</div>
        </div>
      </div>
    </div>
  );
}

