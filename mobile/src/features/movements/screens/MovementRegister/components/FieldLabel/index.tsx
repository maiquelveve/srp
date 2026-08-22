import type { ReactNode } from 'react';
import { Text } from '@/components/ui/text';

interface FieldLabelProps {
  children: ReactNode;
}

export default function FieldLabel({ children }: FieldLabelProps): JSX.Element {
  return (
    <Text variant="muted" className="mb-1 mt-3 text-xs">
      {children}
    </Text>
  );
}
