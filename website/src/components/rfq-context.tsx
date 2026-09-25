'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

/** RFQ 行的数据结构 —— 与需求里的「Add to RFQ 自动带入」字段一一对应 */
export interface RfqLine {
  product_id: string;
  bowen_no: string;
  product_type: string | null;
  matched_oe: string | null;
  vehicle: string | null;
  engine: string | null;
  application_id: string | null;
  quantity: string;
  remark: string;
}

interface RfqState {
  lines: RfqLine[];
  addLine: (line: Omit<RfqLine, 'quantity' | 'remark'> & { quantity?: string; remark?: string }) => void;
  removeLine: (index: number) => void;
  updateLine: (index: number, patch: Partial<RfqLine>) => void;
  clear: () => void;
  count: number;
  ready: boolean;
}

const STORAGE_KEY = 'bowen.rfq.v1';

const RfqContext = createContext<RfqState | null>(null);

function lineKey(l: Pick<RfqLine, 'product_id' | 'matched_oe' | 'application_id'>) {
  return `${l.product_id}::${l.matched_oe ?? ''}::${l.application_id ?? ''}`;
}

export function RfqProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<RfqLine[]>([]);
  const [ready, setReady] = useState(false);

  // 从本地存储恢复（原型阶段用 localStorage；未来换成服务端会话）
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setLines(parsed as RfqLine[]);
      }
    } catch {
      /* 忽略损坏的本地数据 */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      /* 存储不可用时静默降级 */
    }
  }, [lines, ready]);

  const addLine = useCallback<RfqState['addLine']>((incoming) => {
    setLines((prev) => {
      const next: RfqLine = {
        product_id: incoming.product_id,
        bowen_no: incoming.bowen_no,
        product_type: incoming.product_type,
        matched_oe: incoming.matched_oe,
        vehicle: incoming.vehicle,
        engine: incoming.engine,
        application_id: incoming.application_id,
        quantity: incoming.quantity ?? '',
        remark: incoming.remark ?? '',
      };
      const key = lineKey(next);
      const idx = prev.findIndex((l) => lineKey(l) === key);
      if (idx >= 0) {
        const copy = prev.slice();
        copy[idx] = next;
        return copy;
      }
      return [...prev, next];
    });
  }, []);

  const removeLine = useCallback((index: number) => {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateLine = useCallback((index: number, patch: Partial<RfqLine>) => {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const value = useMemo<RfqState>(
    () => ({ lines, addLine, removeLine, updateLine, clear, count: lines.length, ready }),
    [lines, addLine, removeLine, updateLine, clear, ready],
  );

  return <RfqContext.Provider value={value}>{children}</RfqContext.Provider>;
}

export function useRfq(): RfqState {
  const ctx = useContext(RfqContext);
  if (!ctx) throw new Error('useRfq 必须在 <RfqProvider> 内使用');
  return ctx;
}
