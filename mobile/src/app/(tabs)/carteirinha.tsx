import { Empty, Screen, Text } from '@/components/ui';

export default function MemberCard() {
  return (
    <Screen>
      <Text variant="title">Carteirinha</Text>
      <Empty title="Em construção" text="Carteirinha com QR dinâmico chega na Fase 2." />
    </Screen>
  );
}
