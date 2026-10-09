import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { useAuth } from '@/lib/auth';
import { colors } from '@/lib/theme';

// Tabs per profile. Hiding is cosmetic; the database enforces every permission.
export default function TabsLayout() {
  const { kind } = useAuth();
  const isMember = kind === 'subscriber' || kind === 'non_subscriber';
  return (
    <NativeTabs tintColor={colors.highlight}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Notícias</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="newspaper.fill" md="newspaper" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="garagem">
        <NativeTabs.Trigger.Label>Garagem</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="car.fill" md="directions_car" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="parceiros">
        <NativeTabs.Trigger.Label>Parceiros</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="storefront.fill" md="storefront" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="carteirinha" hidden={!isMember}>
        <NativeTabs.Trigger.Label>Carteirinha</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="qrcode" md="qr_code" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="leitor" hidden={kind !== 'partner'}>
        <NativeTabs.Trigger.Label>Ler QR</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="qrcode.viewfinder" md="qr_code_scanner" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="admin" hidden={kind !== 'admin'}>
        <NativeTabs.Trigger.Label>Admin</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="shield.lefthalf.filled" md="admin_panel_settings" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="perfil">
        <NativeTabs.Trigger.Label>Perfil</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person.crop.circle.fill" md="account_circle" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
