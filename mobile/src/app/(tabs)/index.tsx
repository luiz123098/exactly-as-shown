import { Empty, Screen, Text } from '@/components/ui';

export default function News() {
  return (
    <Screen>
      <Text variant="title">Notícias</Text>
      <Empty title="Em construção" text="Notícias automáticas e dos parceiros chegam na Fase 4." />
    </Screen>
  );
}
