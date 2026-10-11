'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BATCH_TARGET_TOTAL,
  LeadTarget,
  OUTREACH_STORAGE_KEY,
} from '@/types/outreach';

export interface OutreachNotification {
  type: 'success' | 'error' | 'info';
  message: string;
}

const MIN_DELAY_SECONDS = 45;
const MAX_DELAY_SECONDS = 90;

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function loadPersistedLeads(): LeadTarget[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(OUTREACH_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return (parsed as LeadTarget[]).map((lead) =>
      lead.status === 'in_queue' ? { ...lead, status: 'ready' } : lead
    );
  } catch {
    return [];
  }
}

function persistLeads(leads: LeadTarget[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(OUTREACH_STORAGE_KEY, JSON.stringify(leads));
  } catch {
    // ignore quota / private-mode errors
  }
}

export function useOutreachQueue() {
  const [leads, setLeads] = useState<LeadTarget[]>(() => loadPersistedLeads());
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [activeTarget, setActiveTarget] = useState<LeadTarget | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [notification, setNotification] = useState<OutreachNotification | null>(null);

  const leadsRef = useRef<LeadTarget[]>([]);
  const runningRef = useRef(false);
  const pausedRef = useRef(false);
  const abortRef = useRef(false);
  const skipRef = useRef(false);

  useEffect(() => {
    leadsRef.current = leads;
  }, [leads]);

  const replaceLeads = useCallback((next: LeadTarget[]) => {
    leadsRef.current = next;
    setLeads(next);
    persistLeads(next);
  }, []);

  const updateLeadAt = useCallback(
    (index: number, patch: Partial<LeadTarget>) => {
      const next = leadsRef.current.map((lead, i) =>
        i === index ? { ...lead, ...patch } : lead
      );
      replaceLeads(next);
    },
    [replaceLeads]
  );

  const showNotification = useCallback(
    (type: OutreachNotification['type'], message: string) => {
      setNotification({ type, message });
    },
    []
  );

  const waitWhilePaused = useCallback(async () => {
    while (pausedRef.current && !abortRef.current) {
      await sleep(300);
    }
  }, []);

  const sentCount = useMemo(
    () => leads.filter((l) => l.status === 'sent').length,
    [leads]
  );
  const failedCount = useMemo(
    () => leads.filter((l) => l.status === 'failed').length,
    [leads]
  );

  const fetchLeads = useCallback(async (): Promise<LeadTarget[]> => {
    setIsFetching(true);
    try {
      const res = await fetch('/api/outreach/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ total: BATCH_TARGET_TOTAL }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success || !Array.isArray(data.data) || data.data.length === 0) {
        throw new Error(data?.error || 'Gagal memuat prospek A1 dari server.');
      }
      const fetched = data.data as LeadTarget[];
      replaceLeads(fetched);
      return fetched;
    } finally {
      setIsFetching(false);
    }
  }, [replaceLeads]);

  const runEngine = useCallback(async () => {
    if (runningRef.current) return;

    runningRef.current = true;
    abortRef.current = false;
    pausedRef.current = false;
    skipRef.current = false;

    setIsRunning(true);
    setIsPaused(false);
    setActiveTarget(null);
    setCountdown(0);
    showNotification('info', 'Menjalankan auto-discovery 75 prospek A1...');

    let fetched: LeadTarget[] = [];
    try {
      fetched = await fetchLeads();
    } catch (err) {
      runningRef.current = false;
      setIsRunning(false);
      showNotification(
        'error',
        err instanceof Error ? err.message : 'Gagal menjalankan auto-discovery.'
      );
      return;
    }

    showNotification('info', `${fetched.length} prospek A1 siap. Memulai pengiriman otomatis...`);

    let sent = 0;
    let failed = 0;

    for (let i = 0; i < fetched.length; i++) {
      if (abortRef.current) break;
      await waitWhilePaused();
      if (abortRef.current) break;

      const target = leadsRef.current[i];
      if (!target) continue;
      if (target.status === 'sent' || target.status === 'skipped') continue;

      if (skipRef.current) {
        skipRef.current = false;
        updateLeadAt(i, { status: 'skipped' });
        continue;
      }

      updateLeadAt(i, { status: 'in_queue' });
      setActiveTarget(leadsRef.current[i]);
      await waitWhilePaused();
      if (abortRef.current) break;

      try {
        const res = await fetch('/api/outreach/send-fonnte', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            target: target.whatsappNumber,
            message: target.generatedMessage || '',
          }),
        });
        const data = await res.json().catch(() => null);
        if (res.ok && data?.success) {
          sent += 1;
          updateLeadAt(i, {
            status: 'sent',
            sentAt: new Date().toISOString(),
            lastError: undefined,
          });
        } else {
          failed += 1;
          updateLeadAt(i, {
            status: 'failed',
            sentAt: new Date().toISOString(),
            lastError: data?.error || 'Gagal mengirim via Fonnte.',
          });
        }
      } catch (err) {
        failed += 1;
        updateLeadAt(i, {
          status: 'failed',
          sentAt: new Date().toISOString(),
          lastError: err instanceof Error ? err.message : 'Kesalahan jaringan.',
        });
      }

      if (i >= fetched.length - 1 || abortRef.current) break;

      setActiveTarget(leadsRef.current[i + 1] || null);
      const delay =
        Math.floor(Math.random() * (MAX_DELAY_SECONDS - MIN_DELAY_SECONDS + 1)) +
        MIN_DELAY_SECONDS;

      for (let s = delay; s >= 0; s--) {
        if (abortRef.current || skipRef.current) break;
        setCountdown(s);
        await sleep(1000);
        await waitWhilePaused();
      }
      setCountdown(0);
    }

    setCountdown(0);
    setActiveTarget(null);
    setIsRunning(false);
    setIsPaused(false);
    runningRef.current = false;

    showNotification(
      failed === 0 ? 'success' : 'info',
      `Batch selesai: ${sent} terkirim, ${failed} gagal dari ${fetched.length} target A1.`
    );
  }, [fetchLeads, showNotification, updateLeadAt, waitWhilePaused]);

  const pauseEngine = useCallback(() => {
    if (!runningRef.current) return;
    pausedRef.current = true;
    setIsPaused(true);
  }, []);

  const resumeEngine = useCallback(() => {
    if (!runningRef.current) return;
    pausedRef.current = false;
    setIsPaused(false);
  }, []);

  const skipCurrent = useCallback(() => {
    if (!runningRef.current) return;
    skipRef.current = true;
    setCountdown(0);
  }, []);

  const resetQueue = useCallback(() => {
    if (runningRef.current) return;
    abortRef.current = true;
    pausedRef.current = false;
    skipRef.current = false;
    replaceLeads([]);
    setActiveTarget(null);
    setCountdown(0);
    setNotification(null);
  }, [replaceLeads]);

  useEffect(() => {
    return () => {
      abortRef.current = true;
    };
  }, []);

  const total = leads.length || BATCH_TARGET_TOTAL;

  return {
    leads,
    isRunning,
    isPaused,
    isFetching,
    sentCount,
    failedCount,
    activeTarget,
    countdown,
    notification,
    total,
    runEngine,
    fetchLeads,
    pauseEngine,
    resumeEngine,
    skipCurrent,
    resetQueue,
  };
}
