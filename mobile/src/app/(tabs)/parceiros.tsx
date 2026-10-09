import { TitleRow } from '@/components/title-row';
import { Empty, Screen } from '@/components/ui';

export default function Partners() {
  return (
    <Screen statusBarScrim>
      <TitleRow title="Parceiros" />
      <Empty title="Em construção" text="Os parceiros do clube e suas promoções chegam na Fase 4." />
    </Screen>
  );
}
