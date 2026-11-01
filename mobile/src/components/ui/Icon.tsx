import React from 'react';
import {
  Brain,
  Calendar,
  ChartColumn,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  CircleCheck,
  ClipboardList,
  House,
  Image,
  Inbox,
  Layers,
  Link,
  Lock,
  Mail,
  Megaphone,
  Menu,
  MessageCircle,
  PenLine,
  Settings,
  Sparkles,
  Target,
  User,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react-native';

/** Lucide line icons (DESIGN.md: set lucide, 2px stroke, 24px default). */
const ICONS = {
  analytics: ChartColumn,
  approvals: CircleCheck,
  brain: Brain,
  calendar: Calendar,
  campaigns: Megaphone,
  chevronDown: ChevronDown,
  chevronLeft: ChevronLeft,
  chevronRight: ChevronRight,
  circle: Circle,
  connections: Link,
  content: PenLine,
  home: House,
  inbox: Inbox,
  leads: Target,
  lock: Lock,
  mail: Mail,
  media: Image,
  menu: Menu,
  settings: Settings,
  sparkles: Sparkles,
  team: Users,
  templates: ClipboardList,
  user: User,
  whatsapp: MessageCircle,
  workspace: Layers,
  zap: Zap,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

type IconProps = {
  name: IconName;
  size?: number;
  color: string;
  strokeWidth?: number;
};

export function Icon({ name, size = 24, color, strokeWidth = 2 }: IconProps) {
  const Component = ICONS[name];
  return <Component size={size} color={color} strokeWidth={strokeWidth} />;
}
