import jsQR from 'jsqr';
import QRCode from 'qrcode';

export async function makeFamilyCodeQrDataUrl(code: string): Promise<string> {
  const normalized = normalizeFamilyCodeQrPayload(code);
  if (!normalized) throw new Error('A six-character family code is required.');
  return QRCode.toDataURL(normalized, {
    errorCorrectionLevel: 'H',
    margin: 2,
    width: 240,
    color: { dark: '#4C1D95', light: '#FFFFFF' },
  });
}

export function decodeFamilyCodeQr(image: ImageData): string | null {
  const result = jsQR(image.data, image.width, image.height, { inversionAttempts: 'dontInvert' });
  return normalizeFamilyCodeQrPayload(result?.data || '');
}

export function normalizeFamilyCodeQrPayload(value: string): string | null {
  const code = String(value || '').trim().toUpperCase();
  return /^[A-Z0-9]{6}$/.test(code) ? code : null;
}
