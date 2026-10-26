import { createHmac, timingSafeEqual } from 'node:crypto';

export function deriveDeviceKey(secret: string, identifier: string): string {
  return createHmac('sha256', secret)
    .update(identifier.toUpperCase())
    .digest('hex');
}

export function isValidDeviceKey(
  secret: string,
  identifier: string,
  key: string,
): boolean {
  const expected = Buffer.from(deriveDeviceKey(secret, identifier));
  const received = Buffer.from(key);
  return (
    expected.length === received.length && timingSafeEqual(expected, received)
  );
}
