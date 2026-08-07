import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

// Colors follow the shadcn "Custom Colors" alert pattern (solid saturated
// dark background + near-white text/icon), not a translucent tint — see
// https://ui.shadcn.com/docs/components/radix/alert#custom-colors and
// research.md #19. Raw Tailwind palette on purpose (matches the reference
// exactly); the app is dark-only so there's no light-mode variant to pair.
const alertVariants = cva('relative flex w-full items-start rounded-lg border', {
  variants: {
    variant: {
      default: 'bg-background text-foreground [&>svg]:text-foreground',
      success: 'border-green-900 bg-green-950 text-green-50 [&>svg]:text-green-50',
      error: 'border-red-900 bg-red-950 text-red-50 [&>svg]:text-red-50',
      warning: 'border-amber-600 bg-amber-700 text-amber-50 [&>svg]:text-amber-50',
      info: 'border-blue-600 bg-blue-700 text-blue-50 [&>svg]:text-blue-50',
    },
    size: {
      xs: 'max-w-xs gap-2 px-3 py-2 text-xs [&>svg]:size-4',
      sm: 'max-w-sm gap-2.5 px-3.5 py-2.5 text-sm [&>svg]:size-4',
      md: 'max-w-md gap-3 px-4 py-3 text-sm [&>svg]:size-5',
      lg: 'max-w-lg gap-3.5 px-5 py-4 text-base [&>svg]:size-6',
      xl: 'max-w-xl gap-4 px-6 py-5 text-lg [&>svg]:size-7',
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'lg',
  },
});

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, size, ...props }, ref) => (
  <div
    ref={ref}
    role="alert"
    className={cn(alertVariants({ variant, size }), '[&>svg]:mt-0.5 [&>svg]:shrink-0', className)}
    {...props}
  />
));
Alert.displayName = 'Alert';

const AlertTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h5 ref={ref} className={cn('font-medium leading-none tracking-tight', className)} {...props} />
  ),
);
AlertTitle.displayName = 'AlertTitle';

const AlertDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('mt-1 text-sm [&_p]:leading-relaxed', className)} {...props} />
  ),
);
AlertDescription.displayName = 'AlertDescription';

export { Alert, AlertTitle, AlertDescription };
