import { Text, TextClassContext } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { View } from 'react-native';

/**
 * Mesma paleta "Custom Colors" do Alert web (frontend/src/components/ui/
 * alert.tsx, research.md #19) — cores cruas do Tailwind, não os tokens
 * semânticos do tema, pra ficar visualmente idêntico ao frontend.
 */
const alertVariants = cva('w-full flex-row items-start gap-3 rounded-lg border px-4 py-3', {
  variants: {
    variant: {
      default: 'bg-background border-border',
      success: 'border-green-900 bg-green-950',
      error: 'border-red-900 bg-red-950',
      warning: 'border-amber-600 bg-amber-700',
      info: 'border-blue-600 bg-blue-700',
    },
  },
  defaultVariants: { variant: 'default' },
});

const ALERT_TEXT_CLASS: Record<NonNullable<VariantProps<typeof alertVariants>['variant']>, string> = {
  default: 'text-foreground',
  success: 'text-green-50',
  error: 'text-red-50',
  warning: 'text-amber-50',
  info: 'text-blue-50',
};

function Alert({
  className,
  variant = 'default',
  ...props
}: React.ComponentProps<typeof View> & React.RefAttributes<View> & VariantProps<typeof alertVariants>) {
  return (
    <TextClassContext.Provider value={ALERT_TEXT_CLASS[variant ?? 'default']}>
      <View className={cn(alertVariants({ variant }), className)} {...props} />
    </TextClassContext.Provider>
  );
}

function AlertTitle({
  className,
  ...props
}: React.ComponentProps<typeof Text> & React.RefAttributes<typeof Text>) {
  return <Text className={cn('font-semibold leading-tight', className)} {...props} />;
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<typeof Text> & React.RefAttributes<typeof Text>) {
  return <Text variant="small" className={cn('mt-0.5 font-normal', className)} {...props} />;
}

export { Alert, AlertDescription, AlertTitle };
