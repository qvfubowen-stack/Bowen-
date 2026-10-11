'use client';

/**
 * Cloudflare Turnstile 前端组件（RFQ 表单用）
 * ===========================================================================
 * 设计要点：
 *   1. **只有配置了 NEXT_PUBLIC_TURNSTILE_SITE_KEY 才加载**：没有 site key 时组件返回 null，
 *      本地与 Preview 环境既不显示验证码，也不会请求 Cloudflare 的脚本。
 *   2. 使用 Cloudflare 官方脚本（explicit 渲染），不使用隐式渲染，避免表单里出现多个 widget。
 *   3. 拿到 token 后回调给父组件，父组件把它放进 RFQ 提交数据的 `turnstile_token`。
 *   4. token 过期 / 超时 → 立刻清空 token（父组件不会拿着过期 token 提交）。
 *   5. 校验失败 → 显示可读提示 + "重试"按钮，允许客户重新尝试。
 *   6. 父组件提交失败后通过 resetSignal 让 widget 重置。
 *   7. 可访问性：容器有 aria-label，状态文字用 role="status" + aria-live="polite"。
 *   8. 只用 NEXT_PUBLIC_ 前缀的 site key；TURNSTILE_SECRET_KEY 永远只在服务端使用。
 *
 * 测试模式（NEXT_PUBLIC_TURNSTILE_MOCK=1）：
 *   自动化测试不允许访问真实 Cloudflare。构建时打开该开关后，组件不加载任何外部脚本，
 *   而是读取测试注入的 window.__BOWEN_TURNSTILE_MOCK__ 作为 token。
 *   这个开关在生产环境会被 config/site-env.mjs 的生产就绪校验直接判为错误（构建失败），
 *   因此不可能在生产生效；即使有人在浏览器里手工设置那个全局变量，
 *   服务端仍然会用真实 secret 向 Cloudflare 校验，伪造的 token 会被拒绝。
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import styles from './TurnstileWidget.module.css';

const SITE_KEY = (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '').trim();
const TEST_MODE = process.env.NEXT_PUBLIC_TURNSTILE_MOCK === '1';

interface TurnstileApi {
  render: (element: HTMLElement, options: Record<string, unknown>) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId?: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
    /** 仅测试模式使用：注入一个固定 token，避免访问真实 Cloudflare */
    __BOWEN_TURNSTILE_MOCK__?: string;
  }
}

let scriptPromise: Promise<void> | null = null;

function loadTurnstileScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-bowen-turnstile]');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('turnstile script failed')));
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.defer = true;
    script.dataset.bowenTurnstile = '1';
    script.addEventListener('load', () => resolve());
    script.addEventListener('error', () => reject(new Error('turnstile script failed')));
    document.head.appendChild(script);
  });

  return scriptPromise;
}

type WidgetState = 'loading' | 'ready' | 'verified' | 'error';

const STATUS_TEXT: Record<WidgetState, string> = {
  loading: 'Loading the verification check…',
  ready: 'Verification check ready. Please complete it before sending.',
  verified: 'Verification check completed.',
  error: 'The verification check could not be completed. Please try again.',
};

export function TurnstileWidget({
  onToken,
  resetSignal = 0,
}: {
  /** token 变化回调；过期或失败时回调 null */
  onToken: (token: string | null) => void;
  /** 值变化时重置 widget（提交失败后使用） */
  resetSignal?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;

  const [state, setState] = useState<WidgetState>('loading');

  const useMockToken = useCallback((): boolean => {
    const token = typeof window === 'undefined' ? '' : (window.__BOWEN_TURNSTILE_MOCK__ ?? '');
    if (token) {
      onTokenRef.current(token);
      setState('verified');
      return true;
    }
    onTokenRef.current(null);
    setState('error');
    return false;
  }, []);

  useEffect(() => {
    if (!SITE_KEY) return;

    if (TEST_MODE) {
      useMockToken();
      return;
    }

    let cancelled = false;
    loadTurnstileScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return;
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: SITE_KEY,
          theme: 'light',
          callback: (token: string) => {
            onTokenRef.current(token);
            setState('verified');
          },
          'expired-callback': () => {
            onTokenRef.current(null);
            setState('ready');
          },
          'timeout-callback': () => {
            onTokenRef.current(null);
            setState('ready');
          },
          'error-callback': () => {
            onTokenRef.current(null);
            setState('error');
          },
        });
        setState('ready');
      })
      .catch(() => {
        if (cancelled) return;
        onTokenRef.current(null);
        setState('error');
      });

    return () => {
      cancelled = true;
      try {
        if (widgetIdRef.current && window.turnstile) window.turnstile.remove(widgetIdRef.current);
      } catch {
        /* widget 可能已经被移除 */
      }
      widgetIdRef.current = null;
    };
  }, [useMockToken]);

  // 提交失败后重置，允许客户重新验证
  useEffect(() => {
    if (!SITE_KEY || resetSignal === 0) return;
    if (TEST_MODE) {
      useMockToken();
      return;
    }
    onTokenRef.current(null);
    try {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.reset(widgetIdRef.current);
        setState('ready');
        return;
      }
    } catch {
      /* 忽略：下面回退到错误提示 */
    }
    setState('error');
  }, [resetSignal, useMockToken]);

  if (!SITE_KEY) return null;

  if (TEST_MODE) {
    return (
      <div className={styles.wrap} data-testid="turnstile-mock" data-test-mode="true">
        <p className={styles.status} role="status" aria-live="polite">
          {state === 'verified'
            ? 'Test verification token supplied (automated test mode — Cloudflare is not contacted).'
            : 'Waiting for the test verification token.'}
        </p>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <p className={styles.label} id="turnstile-label">Verification</p>
      <div
        ref={containerRef}
        className={styles.widget}
        data-testid="turnstile-widget"
        aria-labelledby="turnstile-label"
      />
      <p className={styles.status} role="status" aria-live="polite">{STATUS_TEXT[state]}</p>
      {state === 'error' && (
        <button
          type="button"
          className={styles.retry}
          data-testid="turnstile-retry"
          onClick={() => {
            setState('loading');
            try {
              if (widgetIdRef.current && window.turnstile) {
                window.turnstile.reset(widgetIdRef.current);
                setState('ready');
                return;
              }
            } catch {
              /* 落到下面的错误提示 */
            }
            setState('error');
          }}
        >
          Try the verification again
        </button>
      )}
    </div>
  );
}

/** 构建期是否配置了 Turnstile（父组件据此决定是否要求 token） */
export const TURNSTILE_ENABLED = Boolean(SITE_KEY);
