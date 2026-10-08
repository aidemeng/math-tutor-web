import type { SVGProps } from 'react';
import {
  ArrowUp,
  Share2,
  Copy,
  ExternalLink,
  ChartNoAxesCombined,
  BookOpen,
  Camera,
  Check,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  History,
  LogOut,
  MessageCircle,
  MonitorDown,
  Play,
  Plus,
  RotateCw,
  Sparkles,
  SquarePlay,
  TriangleAlert,
  Video,
  X,
  type LucideIcon,
} from 'lucide-react';

const ICONS = {
  share: Share2,
  copy: Copy,
  external: ExternalLink,
  chart: ChartNoAxesCombined,
  chat: MessageCircle,
  video: Video,
  history: History,
  back: ChevronLeft,
  close: X,
  plus: Plus,
  send: ArrowUp,
  camera: Camera,
  play: Play,
  'square-play': SquarePlay,
  refresh: RotateCw,
  download: Download,
  install: MonitorDown,
  sparkle: Sparkles,
  alert: TriangleAlert,
  check: Check,
  clock: Clock3,
  logout: LogOut,
  chevron: ChevronRight,
  'chevron-down': ChevronDown,
  'chevron-up': ChevronUp,
  book: BookOpen,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
  size?: number;
}

export function Icon({ name, size = 20, style, ...rest }: IconProps) {
  const Glyph = ICONS[name];
  return (
    <Glyph
      size={size}
      strokeWidth={1.8}
      aria-hidden="true"
      focusable="false"
      style={{ flexShrink: 0, ...style }}
      {...rest}
    />
  );
}
