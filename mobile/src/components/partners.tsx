import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Card, Text } from '@/components/ui';
import { isLive, partnerImageUrl, USAGE_LIMIT, type Promotion } from '@/lib/partners';
import { colors, radius, space } from '@/lib/theme';

export function PartnerLogo({ path, name, size = 56 }: { path: string | null | undefined; name: string; size?: number }) {
  const uri = partnerImageUrl(path);
  return uri ? (
    <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 4, backgroundColor: colors.secondary }} contentFit="cover" />
  ) : (
    <View style={{ width: size, height: size, borderRadius: size / 4, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: colors.inkText, fontSize: size / 2.6, lineHeight: size / 2.1 }}>{name.trim().charAt(0).toUpperCase()}</Text>
    </View>
  );
}

// A promotion: image, discount, rules and validity. `header` shows the company
// in lists; `footer` holds actions (use, edit, report).
export function PromotionCard({ promo, header, footer }: { promo: Promotion; header?: ReactNode; footer?: ReactNode }) {
  const uri = partnerImageUrl(promo.image_path);
  const live = isLive(promo);
  return (
    <Card style={{ padding: 0, overflow: 'hidden', opacity: live ? 1 : 0.6 }}>
      {uri && <Image source={{ uri }} style={{ width: '100%', aspectRatio: 16 / 9 }} contentFit="cover" />}
      <View style={{ padding: space.md, gap: space.xs }}>
        {header}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' }}>
          {!!promo.discount_label && (
            <View style={{ paddingHorizontal: space.sm, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: colors.highlight }}>
              <Text style={{ fontSize: 13, color: colors.ink }}>{promo.discount_label}</Text>
            </View>
          )}
          {!live && <Text style={{ fontSize: 12, color: colors.danger }}>{promo.active ? 'Encerrada' : 'Pausada'}</Text>}
        </View>
        <Text variant="heading">{promo.title}</Text>
        {!!promo.description && <Text variant="muted">{promo.description}</Text>}
        <Text variant="label">
          {USAGE_LIMIT[promo.usage_limit]}
          {promo.ends_at ? ` · até ${new Date(promo.ends_at).toLocaleDateString('pt-BR')}` : ''}
        </Text>
        {footer}
      </View>
    </Card>
  );
}
