import { TitleRow } from '@/components/title-row';
import { Empty, Screen } from '@/components/ui';

export default function News() {
  return (
    <Screen statusBarScrim>
      <TitleRow title="Notícias" />
      <Empty title="Em construção" text="Notícias automáticas e dos parceiros chegam na Fase 4." />
    </Screen>
  );
}
