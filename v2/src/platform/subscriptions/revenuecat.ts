const RC_API_KEY = 'appl_RquVpMOZtfpBzJLJButBHBFuolp';
const RC_ENTITLEMENT = 'pro';
const RC_ENTITLEMENT_FALLBACK = 'GemSprout Pro';
const RC_PRODUCT_IDS = ['com.gemsprout.ios.pro.monthly', 'com.gemsprout.ios.pro.yearly'];

type RevenueCatPackage = {
  packageType?: string;
  product?: {
    priceString?: string;
    introPrice?: { periodNumberOfUnits?: number };
  };
};

type CustomerInfo = {
  entitlements?: { active?: Record<string, unknown> };
  activeSubscriptions?: string[];
  allPurchasedProductIdentifiers?: string[];
};

type PurchasesPlugin = {
  configure?: (input: { apiKey: string; appUserID: string }) => Promise<void>;
  getCustomerInfo?: () => Promise<{ customerInfo?: CustomerInfo }>;
  getOfferings?: () => Promise<{ current?: { availablePackages?: RevenueCatPackage[] } }>;
  purchasePackage?: (input: { aPackage: RevenueCatPackage }) => Promise<{ customerInfo?: CustomerInfo }>;
  restorePurchases?: () => Promise<{ customerInfo?: CustomerInfo } | void>;
  invalidateCustomerInfoCache?: () => Promise<void>;
  syncPurchases?: () => Promise<void>;
  addCustomerInfoUpdateListener?: (listener: (customerInfo: CustomerInfo) => void) => Promise<string>;
};

type CapacitorWindow = Window & {
  Capacitor?: {
    isNativePlatform?: () => boolean;
    Plugins?: {
      Purchases?: PurchasesPlugin;
    };
  };
};

export type SubscriptionPlanId = 'monthly' | 'yearly';

export type SubscriptionState = {
  initialized: boolean;
  isNative: boolean;
  isPro: boolean;
  offeringsStatus: 'idle' | 'loading' | 'ready' | 'error';
  selectedPlan: SubscriptionPlanId;
  monthlyPrice: string;
  yearlyPrice: string;
  trialDays: number;
};

let configuredAppUserId = '';
let customerInfoListenerRegistered = false;
let packages: Partial<Record<SubscriptionPlanId, RevenueCatPackage>> = {};

export const subscriptionState: SubscriptionState = {
  initialized: false,
  isNative: false,
  isPro: true,
  offeringsStatus: 'idle',
  selectedPlan: 'yearly',
  monthlyPrice: '$2.99',
  yearlyPrice: '$24.99',
  trialDays: 7,
};

export function isNativeSubscriptionsPlatform(): boolean {
  return !!(window as CapacitorWindow).Capacitor?.isNativePlatform?.();
}

export async function initRevenueCat(appUserId: string): Promise<SubscriptionState> {
  subscriptionState.isNative = isNativeSubscriptionsPlatform();
  if (!subscriptionState.isNative) {
    subscriptionState.initialized = true;
    subscriptionState.isPro = true;
    return { ...subscriptionState };
  }

  const purchases = getPurchasesPlugin();
  if (!purchases?.configure || !purchases.getCustomerInfo || !appUserId) {
    subscriptionState.initialized = true;
    subscriptionState.isPro = false;
    return { ...subscriptionState };
  }

  try {
    if (configuredAppUserId !== appUserId) {
      await purchases.configure({ apiKey: RC_API_KEY, appUserID: appUserId });
      configuredAppUserId = appUserId;
    }
    registerCustomerInfoListener(purchases);
    const { customerInfo } = await readFreshCustomerInfo(purchases);
    subscriptionState.isPro = hasProAccess(customerInfo);
  } catch {
    subscriptionState.isPro = false;
  } finally {
    subscriptionState.initialized = true;
  }
  return { ...subscriptionState };
}

export async function refreshEntitlement(): Promise<boolean> {
  subscriptionState.isNative = isNativeSubscriptionsPlatform();
  if (!subscriptionState.isNative) {
    subscriptionState.isPro = true;
    return true;
  }
  const purchases = getPurchasesPlugin();
  if (!purchases?.getCustomerInfo) {
    subscriptionState.isPro = false;
    return false;
  }
  try {
    const { customerInfo } = await readFreshCustomerInfo(purchases);
    subscriptionState.isPro = hasProAccess(customerInfo);
  } catch {
    // Preserve the last known value if RevenueCat is temporarily unreachable.
  }
  return subscriptionState.isPro;
}

export async function loadOfferings(): Promise<SubscriptionState> {
  subscriptionState.offeringsStatus = 'loading';
  packages = {};
  subscriptionState.isNative = isNativeSubscriptionsPlatform();
  if (!subscriptionState.isNative) {
    subscriptionState.offeringsStatus = 'ready';
    return { ...subscriptionState };
  }
  const purchases = getPurchasesPlugin();
  if (!purchases?.getOfferings) {
    subscriptionState.offeringsStatus = 'error';
    return { ...subscriptionState };
  }
  try {
    const offerings = await purchases.getOfferings();
    const available = offerings?.current?.availablePackages || [];
    for (const item of available) {
      if (item.packageType === 'MONTHLY') packages.monthly = item;
      if (item.packageType === 'ANNUAL') packages.yearly = item;
    }
    subscriptionState.monthlyPrice = packages.monthly?.product?.priceString || subscriptionState.monthlyPrice;
    subscriptionState.yearlyPrice = packages.yearly?.product?.priceString || subscriptionState.yearlyPrice;
    subscriptionState.trialDays = packages.yearly?.product?.introPrice?.periodNumberOfUnits
      || packages.monthly?.product?.introPrice?.periodNumberOfUnits
      || subscriptionState.trialDays;
    subscriptionState.offeringsStatus = packages.monthly || packages.yearly ? 'ready' : 'error';
  } catch {
    subscriptionState.offeringsStatus = 'error';
  }
  return { ...subscriptionState };
}

export function selectSubscriptionPlan(plan: SubscriptionPlanId): SubscriptionState {
  subscriptionState.selectedPlan = plan;
  return { ...subscriptionState };
}

export async function purchaseSelectedPlan(): Promise<{ ok: boolean; cancelled?: boolean; message?: string }> {
  if (!isNativeSubscriptionsPlatform()) {
    subscriptionState.isPro = true;
    return { ok: true };
  }
  if (subscriptionState.offeringsStatus === 'loading') return { ok: false, message: 'Loading subscription options...' };
  const selectedPackage = packages[subscriptionState.selectedPlan];
  if (!selectedPackage) return { ok: false, message: 'Could not load subscription options - tap Retry' };
  const purchases = getPurchasesPlugin();
  if (!purchases?.purchasePackage) return { ok: false, message: 'Purchases are unavailable on this device.' };
  try {
    const result = await purchases.purchasePackage({ aPackage: selectedPackage });
    subscriptionState.isPro = hasProAccess(result?.customerInfo) || await syncAndRefreshEntitlement(purchases);
    return subscriptionState.isPro ? { ok: true } : { ok: false, message: 'Purchase is processing. Please tap Restore Purchases.' };
  } catch (error) {
    const entitled = await syncAndRefreshEntitlement(purchases);
    if (entitled) return { ok: true };
    const maybeCancelled = error as { userCancelled?: boolean; message?: string };
    return { ok: false, cancelled: !!maybeCancelled.userCancelled, message: maybeCancelled.userCancelled ? undefined : 'Purchase failed - please try again' };
  }
}

export async function restorePurchases(): Promise<boolean> {
  if (!isNativeSubscriptionsPlatform()) {
    subscriptionState.isPro = true;
    return true;
  }
  const purchases = getPurchasesPlugin();
  if (!purchases?.restorePurchases) return false;
  try {
    const result = await purchases.restorePurchases();
    subscriptionState.isPro = hasProAccess(result?.customerInfo) || await syncAndRefreshEntitlement(purchases);
  } catch {
    subscriptionState.isPro = false;
  }
  return subscriptionState.isPro;
}

export function openManageSubscriptions(): void {
  openExternalUrl('https://apps.apple.com/account/subscriptions');
}

export function openPrivacyPolicy(): void {
  openExternalUrl('https://gemsprout.com/privacy.html');
}

export function openTermsOfUse(): void {
  openExternalUrl('https://www.apple.com/legal/internet-services/itunes/dev/stdeula/');
}

async function syncAndRefreshEntitlement(purchases = getPurchasesPlugin()): Promise<boolean> {
  if (!purchases) return refreshEntitlement();
  try {
    await purchases.syncPurchases?.();
  } catch {}
  for (const delayMs of [0, 700, 1800]) {
    if (delayMs) await delay(delayMs);
    try {
      const { customerInfo } = await readFreshCustomerInfo(purchases);
      subscriptionState.isPro = hasProAccess(customerInfo);
      if (subscriptionState.isPro) return true;
    } catch {}
  }
  return subscriptionState.isPro;
}

async function readFreshCustomerInfo(purchases: PurchasesPlugin): Promise<{ customerInfo?: CustomerInfo }> {
  try {
    await purchases.invalidateCustomerInfoCache?.();
  } catch {}
  return purchases.getCustomerInfo?.() || {};
}

function registerCustomerInfoListener(purchases: PurchasesPlugin): void {
  if (customerInfoListenerRegistered || !purchases.addCustomerInfoUpdateListener) return;
  customerInfoListenerRegistered = true;
  void purchases.addCustomerInfoUpdateListener(customerInfo => {
    subscriptionState.isPro = hasProAccess(customerInfo);
  }).catch(() => {
    customerInfoListenerRegistered = false;
  });
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => window.setTimeout(resolve, ms));
}

function hasProAccess(customerInfo?: CustomerInfo): boolean {
  const activeEntitlements = customerInfo?.entitlements?.active || {};
  if (activeEntitlements[RC_ENTITLEMENT] || activeEntitlements[RC_ENTITLEMENT_FALLBACK]) return true;
  if (Object.keys(activeEntitlements).some(key => /pro|gemsprout/i.test(key))) return true;
  const activeSubscriptions = customerInfo?.activeSubscriptions || [];
  const purchasedProducts = customerInfo?.allPurchasedProductIdentifiers || [];
  const recognizedProducts = [...activeSubscriptions, ...purchasedProducts];
  return recognizedProducts.some(productId => RC_PRODUCT_IDS.includes(productId) || /^com\.gemsprout\.ios\./.test(productId));
}

function getPurchasesPlugin(): PurchasesPlugin | null {
  return (window as CapacitorWindow).Capacitor?.Plugins?.Purchases || null;
}

function openExternalUrl(url: string): void {
  try {
    if (isNativeSubscriptionsPlatform()) window.open(url, '_system');
    else window.open(url, '_blank');
  } catch {
    window.location.href = url;
  }
}
