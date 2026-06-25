export function mapCategory(r: Record<string, unknown>) {
  return {
    id: r.id as number,
    name: r.name as string,
    color: r.color as string,
    icon: r.icon as string,
    needsKitchen: r.needs_kitchen === undefined ? true : (r.needs_kitchen as boolean),
    createdAt: new Date(r.created_at as string)
  };
}

export function mapProduct(r: Record<string, unknown>) {
  return {
    id: r.id as number,
    name: r.name as string,
    sku: r.sku as string,
    categoryId: r.category_id as number,
    price: Number(r.price),
    hpp: Number(r.hpp),
    stock: Number(r.stock),
    unit: r.unit as string,
    variants: (r.variants as any) ?? [],
    photo: r.photo as string | undefined,
    barcode: r.barcode as string | undefined,
    createdAt: new Date(r.created_at as string),
    updatedAt: new Date(r.updated_at as string)
  };
}

export function mapStoreSettings(s: Record<string, unknown>) {
  return {
    id: s.id as number,
    storeName: s.store_name as string,
    address: s.address as string,
    phone: s.phone as string,
    receiptFooter: s.receipt_footer as string,
    onboardingDone: s.onboarding_done as boolean,
    themeColor: s.theme_color as string,
    logo: s.logo as string,
    tables: s.tables as string[],
    deliveryMode: (s.delivery_mode as 'ambil' | 'diantar') || 'diantar',
    enableWhatsappNotification: s.enable_whatsapp_notification === undefined ? false : (s.enable_whatsapp_notification as boolean),
    enableTax: s.enable_tax === undefined ? false : (s.enable_tax as boolean),
    taxPercentage: s.tax_percentage ? Number(s.tax_percentage) : 0,
    enableAdminFee: s.enable_admin_fee === undefined ? false : (s.enable_admin_fee as boolean),
    adminFeeValue: s.admin_fee_value ? Number(s.admin_fee_value) : 0,
    enableSplitBill: s.enable_split_bill === undefined ? true : (s.enable_split_bill as boolean)
  };
}
