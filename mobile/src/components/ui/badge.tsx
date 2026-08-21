import { TextClassContext } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { Slot } from '@rn-primitives/slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { View } from 'react-native';

const badgeVariants = cva(
  'border-border group shrink-0 flex-row items-center justify-center gap-1 overflow-hidden rounded-full border px-2 py-0.5',
  {
    variants: {
      variant: {
        default: 'bg-primary border-transparent',
        secondary: 'bg-secondary border-transparent',
        destructive: 'bg-destructive border-transparent',
        warning: 'bg-warning border-transparent',
        outline: '',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

const badgeTextVariants = cva('text-xs font-medium', {
  variants: {
    variant: {
      default: 'text-primary-foreground',
      secondary: 'text-secondary-foreground',
      destructive: 'text-white',
      warning: 'text-warning-foreground',
      outline: 'text-foreground',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

type BadgeProps = React.ComponentProps<typeof View> &
  React.RefAttributes<View> & {
    asChild?: boolean;
  } & VariantProps<typeof badgeVariants>;

function Badge({ className, variant, asChild, ...props }: BadgeProps) {
  const Component = asChild ? Slot : View;
  return (
    <TextClassContext.Provider value={badgeTextVariants({ variant })}>
      <Component className={cn(badgeVariants({ variant }), className)} {...props} />
    </TextClassContext.Provider>
  );
}

export { Badge, badgeTextVariants, badgeVariants };
export type { BadgeProps };
