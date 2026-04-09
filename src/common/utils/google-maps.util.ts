import { BadRequestException } from '@nestjs/common';

/**
 * Extracts latitude and longitude from a Google Maps URL.
 *
 * Supported formats:
 *   - https://maps.google.com/?q=30.0131,-31.2089
 *   - https://www.google.com/maps/@30.0131,31.2089,...
 *   - https://www.google.com/maps/place/.../@30.0131,31.2089,...
 *   - https://goo.gl/maps/... (short links won't work — must be full URL)
 *   - https://maps.app.goo.gl/... with ?q= or embedded coords
 *   - Plain "lat,lng" string (e.g. "30.0131,31.2089")
 */
export function extractCoordsFromGoogleMapsLink(
  link: string,
): { latitude: number; longitude: number } {
  // Pattern 1: ?q=lat,lng or &q=lat,lng
  const qParam = /[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/.exec(link);
  if (qParam) {
    return { latitude: parseFloat(qParam[1]), longitude: parseFloat(qParam[2]) };
  }

  // Pattern 2: /@lat,lng
  const atSign = /@(-?\d+\.?\d*),(-?\d+\.?\d*)/.exec(link);
  if (atSign) {
    return { latitude: parseFloat(atSign[1]), longitude: parseFloat(atSign[2]) };
  }

  // Pattern 3: plain "lat,lng"
  const plain = /^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/.exec(link.trim());
  if (plain) {
    return { latitude: parseFloat(plain[1]), longitude: parseFloat(plain[2]) };
  }

  throw new BadRequestException(
    'لا يمكن استخراج الإحداثيات من رابط خرائط جوجل — يرجى إرسال رابط صالح',
  );
}
