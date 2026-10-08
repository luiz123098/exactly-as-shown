import { Empty, Screen, Text } from '@/components/ui';

export default function Garage() {
  return (
    <Screen>
      <Text variant="title">Garagem</Text>
      <Empty title="Em construção" text="Garagens dos membros chegam na Fase 3." />
    </Screen>
  );
}
