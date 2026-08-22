const fallbackPreviewPhone = '+967700000001';

export const previewManagerPersona = {
  fullName: process.env.EXPO_PUBLIC_PREVIEW_MANAGER_NAME?.trim() || 'محمد باحكم',
  phone: process.env.EXPO_PUBLIC_PREVIEW_MANAGER_PHONE?.trim() || fallbackPreviewPhone,
  role: 'manager' as const,
  businessName: 'باحكم للعسل',
};

export function isConfiguredPreviewManagerPhone(): boolean {
  return Boolean(process.env.EXPO_PUBLIC_PREVIEW_MANAGER_PHONE?.trim());
}
