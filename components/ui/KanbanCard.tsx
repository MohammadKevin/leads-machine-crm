import React from 'react';
import { Card } from './Card';

export interface KanbanCardProps {
  id: string;
  businessName: string;
  category?: string;
  city?: string;
  dealEstimate?: string;
  onClick?: () => void;
  onDragStart?: (e: React.DragEvent) => void;
  isDragging?: boolean;
}

export function KanbanCard({
  id,
  businessName,
  category,
  city,
  dealEstimate,
  onClick,
  onDragStart,
  isDragging = false,
}: KanbanCardProps) {
  const subtitleParts = [city || category, dealEstimate].filter(Boolean);

  return (
    <Card
      draggable={Boolean(onDragStart)}
      onDragStart={onDragStart}
      onClick={onClick}
      className={`p-3.5 cursor-pointer transition-all duration-150 hover:shadow-md hover:ring-[#DAD7CC] select-none ${
        isDragging ? 'opacity-40 scale-98' : 'opacity-100'
      }`}
    >
      <div className="text-[14px] font-semibold text-[#1B1B18] leading-snug line-clamp-2">
        {businessName}
      </div>
      {subtitleParts.length > 0 && (
        <div className="text-[13px] text-[#6B6A63] mt-1 truncate">
          {subtitleParts.join(' · ')}
        </div>
      )}
    </Card>
  );
}

