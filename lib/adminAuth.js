import crypto from 'crypto';

// Constant-time comparison of two secrets. Hash both first so length differences
// don't leak and timingSafeEqual always gets equal-length buffers.
export function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a ?? '')).digest();
  const hb = crypto.createHash('sha256').update(String(b ?? '')).digest();
  return crypto.timingSafeEqual(ha, hb);
}
