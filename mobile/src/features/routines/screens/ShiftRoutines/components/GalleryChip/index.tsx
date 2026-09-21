import { Pressable } from 'react-native';
import { Badge } from '@/components/ui/badge';
import { Text } from '@/components/ui/text';

export default function GalleryChip({
  code,
  selected,
  onPress,
}: {
  code: string;
  selected: boolean;
  onPress: () => void;
}): JSX.Element {
  return (
    <Pressable onPress={onPress} className="active:opacity-70">
      <Badge variant={selected ? 'default' : 'outline'} className="px-3 py-1.5">
        <Text
          className={
            selected
              ? 'text-primary-foreground text-sm font-bold'
              : 'text-foreground text-sm font-bold'
          }
        >
          {code}
        </Text>
      </Badge>
    </Pressable>
  );
}
