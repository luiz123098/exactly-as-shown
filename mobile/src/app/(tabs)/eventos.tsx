import { TitleRow } from '@/components/title-row';
import { Empty, Screen } from '@/components/ui';

export default function Events() {
  return (
    <Screen statusBarScrim>
      <TitleRow title="Eventos" />
      <Empty title="Em construção" text="Os eventos da Exotic Experience chegam em breve." />
    </Screen>
  );
}
