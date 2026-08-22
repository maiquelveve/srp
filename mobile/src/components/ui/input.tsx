import { cn } from '@/lib/utils';
import { colors } from '@/theme/colors';
import * as React from 'react';
import { Platform, TextInput } from 'react-native';

function Input({
  className,
  error,
  onFocus,
  onBlur,
  ...props
}: React.ComponentProps<typeof TextInput> &
  React.RefAttributes<TextInput> & { error?: boolean }) {
  const [isFocused, setIsFocused] = React.useState(false);

  return (
    <TextInput
      className={cn(
        'border-input bg-black text-foreground flex h-14 w-full min-w-0 flex-row items-center rounded-md border px-3 py-1 text-base leading-5 shadow-sm shadow-black/5 sm:h-12',
        error ? 'border-destructive' : isFocused && 'border-primary',
        props.editable === false &&
          cn('opacity-50', Platform.select({ web: 'disabled:pointer-events-none disabled:cursor-not-allowed' })),
        Platform.select({
          web: cn(
            'placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground outline-none transition-[color,box-shadow] md:text-sm',
            'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
            'aria-invalid:ring-destructive/20 aria-invalid:border-destructive'
          ),
          native: 'placeholder:text-muted-foreground/50',
        }),
        className
      )}
      cursorColor={colors.foreground}
      selectionColor={colors.primary}
      onFocus={(event) => {
        setIsFocused(true);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        setIsFocused(false);
        onBlur?.(event);
      }}
      {...props}
    />
  );
}

export { Input };
