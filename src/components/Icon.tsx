import type { SVGProps } from 'react';

export type IconName =
  | 'chat'
  | 'video'
  | 'history'
  | 'back'
  | 'close'
  | 'plus'
  | 'send'
  | 'camera'
  | 'play'
  | 'refresh'
  | 'download'
  | 'install'
  | 'sparkle'
  | 'alert'
  | 'check'
  | 'clock'
  | 'logout'
  | 'chevron'
  | 'book';

const PATHS: Record<IconName, { d?: string; node?: React.ReactNode; fill?: boolean }> = {
  chat: {
    d: 'M21 14.5a2.5 2.5 0 0 1-2.5 2.5H7.5L3.5 21V5A2.5 2.5 0 0 1 6 2.5h12.5A2.5 2.5 0 0 1 21 5z',
  },
  video: { d: 'M3 6.5A2.5 2.5 0 0 1 5.5 4h7A2.5 2.5 0 0 1 15 6.5v11A2.5 2.5 0 0 1 12.5 20h-7A2.5 2.5 0 0 1 3 17.5zM15 10.2l4.3-2.7a.8.8 0 0 1 1.2.7v7.6a.8.8 0 0 1-1.2.7L15 13.8z' },
  history: { d: 'M3.2 12a8.8 8.8 0 1 0 2.6-6.2M3 4v4.5h4.5M12 7.6V12l3 1.8' },
  back: { d: 'M15 5l-7 7 7 7' },
  close: { d: 'M6 6l12 12M18 6L6 18' },
  plus: { d: 'M12 5v14M5 12h14' },
  send: { d: 'M12 19V5M5 12l7-7 7 7' },
  camera: {
    d: 'M22 17.5A1.5 1.5 0 0 1 20.5 19h-17A1.5 1.5 0 0 1 2 17.5v-9A1.5 1.5 0 0 1 3.5 7H7l1.6-2.2A1 1 0 0 1 9.4 4.4h5.2a1 1 0 0 1 .8.4L17 7h3.5A1.5 1.5 0 0 1 22 8.5zM12 15.4a2.9 2.9 0 1 0 0-5.8 2.9 2.9 0 0 0 0 5.8z',
  },
  play: { d: 'M8 5.6l10.5 6.4L8 18.4z', fill: true },
  refresh: { d: 'M20.5 12a8.5 8.5 0 1 1-2.6-6.1M20.5 4.5V9H16' },
  download: { d: 'M12 3.5v11M7.5 10.5l4.5 4.5 4.5-4.5M4 19.5h16' },
  install: { d: 'M12 3.5v10M8 10l4 4 4-4M5 20.5h14M5 16.5h14' },
  sparkle: { d: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z' },
  alert: { d: 'M12 8.5v5M12 17h.01M10.3 3.9 2.5 17.4A2 2 0 0 0 4.2 20.4h15.6a2 2 0 0 0 1.7-3l-7.8-13.5a2 2 0 0 0-3.4 0z' },
  check: { d: 'M4.5 12.5l5 5 10-11' },
  clock: { d: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7.5V12l3.2 2' },
  logout: { d: 'M15 8.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2v-2.5M11 12h10M18 8.5 21.5 12 18 15.5' },
  chevron: { d: 'M9 5l7 7-7 7' },
  book: { d: 'M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5zM19 18v3H6.5A2.5 2.5 0 0 1 4 18.5' },
};

interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
  size?: number;
}

export function Icon({ name, size = 20, ...rest }: IconProps) {
  const spec = PATHS[name];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {spec.fill ? (
        <path d={spec.d} fill="currentColor" stroke="none" />
      ) : (
        <path d={spec.d} />
      )}
    </svg>
  );
}
