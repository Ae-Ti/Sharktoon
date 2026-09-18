/**
 * 샥툰 디자인 토큰 — Tailwind 테마 확장.
 * 값의 원본은 design/tokens.css 이고, 원본의 원본은 디자인 시스템 아티팩트다.
 * tailwind.config.ts 에서: import { sharktoonTheme } from './design/tailwind.theme'
 *   theme: { extend: sharktoonTheme }
 * app/globals.css 맨 위에서: @import './../design/tokens.css';
 */
export const sharktoonTheme = {
  colors: {
      'surface-page': 'var(--surface-page)',
      'surface-card': 'var(--surface-card)',
      'surface-sunken': 'var(--surface-sunken)',
      'surface-inverse': 'var(--surface-inverse)',
      'ink': 'var(--ink)',
      'ink-muted': 'var(--ink-muted)',
      'ink-subtle': 'var(--ink-subtle)',
      'ink-inverse': 'var(--ink-inverse)',
      'border': 'var(--border)',
      'border-control': 'var(--border-control)',
      'brand': 'var(--brand)',
      'brand-hover': 'var(--brand-hover)',
      'brand-ink': 'var(--brand-ink)',
      'brand-tint': 'var(--brand-tint)',
      'on-brand': 'var(--on-brand)',
      'accent': 'var(--accent)',
      'accent-ink': 'var(--accent-ink)',
      'accent-tint': 'var(--accent-tint)',
      'success': 'var(--success)',
      'success-tint': 'var(--success-tint)',
      'warning': 'var(--warning)',
      'warning-tint': 'var(--warning-tint)',
      'danger': 'var(--danger)',
      'danger-tint': 'var(--danger-tint)',
      'on-signal': 'var(--on-signal)',
      'overlay': 'var(--overlay)',
      'canvas-grid': 'var(--canvas-grid)',
      'skeleton': 'var(--skeleton)',
  },
  spacing: {
      '1': 'var(--space-1)',
      '2': 'var(--space-2)',
      '3': 'var(--space-3)',
      '4': 'var(--space-4)',
      '5': 'var(--space-5)',
      '6': 'var(--space-6)',
      '8': 'var(--space-8)',
      '10': 'var(--space-10)',
      '12': 'var(--space-12)',
      '16': 'var(--space-16)',
  },
  borderRadius: {
      'sm': 'var(--radius-sm)',
      'md': 'var(--radius-md)',
      'lg': 'var(--radius-lg)',
      'xl': 'var(--radius-xl)',
      'full': 'var(--radius-full)',
  },
  boxShadow: {
      'sm': 'var(--shadow-sm)',
      'md': 'var(--shadow-md)',
      'lg': 'var(--shadow-lg)',
  },
  height: {
      'control-sm': 'var(--control-sm)',
      'control-md': 'var(--control-md)',
      'control-lg': 'var(--control-lg)',
  },
  minHeight: {
      'control-sm': 'var(--control-sm)',
      'control-md': 'var(--control-md)',
      'control-lg': 'var(--control-lg)',
  },
  fontFamily: {
      sans: 'var(--font-sans)',
      mono: 'var(--font-mono)',
  },
  fontSize: {
      'display-lg': ['32px', { lineHeight: '40px', fontWeight: '700', letterSpacing: '-0.02em' }],
      'display': ['26px', { lineHeight: '34px', fontWeight: '700', letterSpacing: '-0.015em' }],
      'title-lg': ['20px', { lineHeight: '28px', fontWeight: '700' }],
      'title': ['17px', { lineHeight: '26px', fontWeight: '600' }],
      'body': ['15px', { lineHeight: '25px', fontWeight: '400' }],
      'body-sm': ['13px', { lineHeight: '21px', fontWeight: '400' }],
      'label': ['13px', { lineHeight: '18px', fontWeight: '600' }],
      'caption': ['12px', { lineHeight: '16px', fontWeight: '500' }],
      'code': ['13px', { lineHeight: '20px', fontWeight: '400' }],
  },
} as const;

export default sharktoonTheme;
