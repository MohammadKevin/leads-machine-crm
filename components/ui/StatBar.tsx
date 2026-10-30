import React from 'react';
import { Card } from './Card';
import { Button } from './Button';

export interface StatItem {
  label: string;
  value: number | string;
  target?: number | string;
}

export interface StatBarProps {
  stats: StatItem[];
  statusText?: string;
  isAutoSending?: boolean;
  onToggleAutoSend?: () => void;
  onExportCsv?: () => void;
  canAutoSend?: boolean;
}

export function StatBar({
  stats,
  statusText = 'Jeda 20 pesan · siap dikirim',
  isAutoSending = false,
  onToggleAutoSend,
  onExportCsv,
  canAutoSend = true,
}: StatBarProps) {
  return (
    <Card className="px-5 py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-4">
      {/* Stats list */}
      <div className="flex items-center gap-6 sm:gap-8 flex-wrap">
        {stats.map((item, idx) => (
          <div key={idx} className="flex flex-col">
            <span className="text-[12px] text-[#6B6A63] font-normal">{item.label}</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-[20px] font-semibold text-[#1B1B18] leading-none tabular-nums">
                {item.value}
              </span>
              {item.target !== undefined && (
                <span className="text-[13px] text-[#6B6A63] font-normal tabular-nums">
                  / {item.target}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-3 self-end md:self-auto flex-wrap">
        {statusText && (
          <span className="text-[13px] text-[#6B6A63] select-none">{statusText}</span>
        )}
        {onToggleAutoSend && (
          <Button
            type="button"
            variant={isAutoSending ? 'danger' : 'primary'}
            size="sm"
            onClick={onToggleAutoSend}
            disabled={!canAutoSend && !isAutoSending}
          >
            {isAutoSending ? 'Hentikan' : 'Mulai auto-send'}
          </Button>
        )}
        {onExportCsv && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onExportCsv}
          >
            Ekspor CSV
          </Button>
        )}
      </div>
    </Card>
  );
}

