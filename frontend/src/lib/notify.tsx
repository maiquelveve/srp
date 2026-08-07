import type { CSSProperties } from 'react';
import { AlertCircleIcon, AlertTriangleIcon, CheckCircle2Icon, InfoIcon, type LucideIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export type NotifyType = 'success' | 'error' | 'info' | 'warning';

export type NotifyPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

export type NotifySize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface NotifyOptions {
  message: string;
  /** Appended to the fixed per-type title as "Erro - {title}". Omit to keep just "Erro". */
  title?: string;
  type?: NotifyType;
  position?: NotifyPosition;
  size?: NotifySize;
  duration?: number;
}

const ICON_BY_TYPE: Record<NotifyType, LucideIcon> = {
  success: CheckCircle2Icon,
  error: AlertCircleIcon,
  warning: AlertTriangleIcon,
  info: InfoIcon,
};

const TITLE_BY_TYPE: Record<NotifyType, string> = {
  success: 'Sucesso',
  error: 'Erro',
  warning: 'Atenção',
  info: 'Informação',
};

// `unstyled: true` makes sonner render `data-styled="false"` on the toast
// <li>, which drops the *entire* `[data-sonner-toast][data-styled='true']`
// CSS rule — including `width: var(--width)`. So the --width custom
// property alone does nothing once unstyled; the actual `width` property
// has to be set directly (inline style always wins regardless of which
// data-styled branch is active). Matches Alert's `max-w-*` per size.
const WIDTH_PX_BY_SIZE: Record<NotifySize, number> = {
  xs: 320,
  sm: 384,
  md: 448,
  lg: 512,
  xl: 576,
};

/**
 * Single entry point for user-facing notifications across the app — every
 * feature calls this instead of managing its own inline error/success text,
 * so all notifications look and behave the same everywhere. Title is fixed
 * per `type` (Erro/Sucesso/Atenção/Informação); pass `title` to append a
 * complement ("Erro - Credenciais incorretas") — omit it to keep just the
 * fixed word. `message` is the detail text underneath. `size` controls
 * width/padding/font/icon together (`xs`–`xl`, defaults to `lg`). Renders
 * our own `Alert` (shadcn "Custom Colors" pattern) as the toast body —
 * `sonner` only supplies positioning/stacking/auto-dismiss, not the visual
 * style — research.md #19.
 */
export function notify({ message, title, type = 'info', position, size = 'lg', duration }: NotifyOptions): void {
  const Icon = ICON_BY_TYPE[type];
  const fullTitle = title ? `${TITLE_BY_TYPE[type]} - ${title}` : TITLE_BY_TYPE[type];

  toast.custom(
    () => (
      <Alert variant={type} size={size} className="shadow-lg">
        <Icon />
        <div className="flex-1">
          <AlertTitle>{fullTitle}</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </div>
      </Alert>
    ),
    {
      position,
      duration,
      unstyled: true,
      style: { width: `${WIDTH_PX_BY_SIZE[size]}px` } as CSSProperties,
    },
  );
}
