import type { LeadStatus } from '@/lib/outreach-data';

const STATUS_STYLE: Record<LeadStatus, { label: string; bg: string; dot: string }> = {
  pending: { label: 'Pending', bg: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-400' },
  sent: { label: 'Sent', bg: 'bg-sky-50 text-sky-700 border-sky-200', dot: 'bg-sky-400' },
  replied: { label: 'Replied', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-400' },
};

export default function StatusBadge({ status }: { status: LeadStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${s.bg}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}