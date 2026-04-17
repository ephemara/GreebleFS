export interface ExplorerChecksumResult {
  md5: string;
  sha256: string;
}

export async function calculateExplorerChecksumsFromBase64(base64: string): Promise<ExplorerChecksumResult> {
  const bytes = base64ToBytes(base64);
  const [sha256, md5] = await Promise.all([
    digestSha256(bytes),
    Promise.resolve(digestMd5(bytes)),
  ]);

  return { md5, sha256 };
}

function base64ToBytes(base64: string): Uint8Array {
  if (typeof atob === 'function') {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index) & 0xff;
    }
    return bytes;
  }

  const binary = globalThis.Buffer?.from(base64, 'base64');
  if (!binary) {
    throw new Error('Base64 decoding is not available in this runtime.');
  }
  return new Uint8Array(binary);
}

async function digestSha256(bytes: Uint8Array): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error('SHA-256 hashing is not available in this runtime.');
  }

  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return bytesToHex(new Uint8Array(digest));
}

function digestMd5(bytes: Uint8Array): string {
  const words = bytesToMd5Words(bytes);
  const a0 = 0x67452301;
  const b0 = 0xefcdab89;
  const c0 = 0x98badcfe;
  const d0 = 0x10325476;

  let a = a0;
  let b = b0;
  let c = c0;
  let d = d0;

  for (let index = 0; index < words.length; index += 16) {
    const aa = a;
    const bb = b;
    const cc = c;
    const dd = d;

    a = md5Round(a, b, c, d, words[index + 0] ?? 0, 7, 0xd76aa478, 0);
    d = md5Round(d, a, b, c, words[index + 1] ?? 0, 12, 0xe8c7b756, 1);
    c = md5Round(c, d, a, b, words[index + 2] ?? 0, 17, 0x242070db, 2);
    b = md5Round(b, c, d, a, words[index + 3] ?? 0, 22, 0xc1bdceee, 3);
    a = md5Round(a, b, c, d, words[index + 4] ?? 0, 7, 0xf57c0faf, 4);
    d = md5Round(d, a, b, c, words[index + 5] ?? 0, 12, 0x4787c62a, 5);
    c = md5Round(c, d, a, b, words[index + 6] ?? 0, 17, 0xa8304613, 6);
    b = md5Round(b, c, d, a, words[index + 7] ?? 0, 22, 0xfd469501, 7);
    a = md5Round(a, b, c, d, words[index + 8] ?? 0, 7, 0x698098d8, 8);
    d = md5Round(d, a, b, c, words[index + 9] ?? 0, 12, 0x8b44f7af, 9);
    c = md5Round(c, d, a, b, words[index + 10] ?? 0, 17, 0xffff5bb1, 10);
    b = md5Round(b, c, d, a, words[index + 11] ?? 0, 22, 0x895cd7be, 11);
    a = md5Round(a, b, c, d, words[index + 12] ?? 0, 7, 0x6b901122, 12);
    d = md5Round(d, a, b, c, words[index + 13] ?? 0, 12, 0xfd987193, 13);
    c = md5Round(c, d, a, b, words[index + 14] ?? 0, 17, 0xa679438e, 14);
    b = md5Round(b, c, d, a, words[index + 15] ?? 0, 22, 0x49b40821, 15);

    a = md5Round(a, b, c, d, words[index + 1] ?? 0, 5, 0xf61e2562, 16, 0x5a827999);
    d = md5Round(d, a, b, c, words[index + 6] ?? 0, 9, 0xc040b340, 17, 0x5a827999);
    c = md5Round(c, d, a, b, words[index + 11] ?? 0, 14, 0x265e5a51, 18, 0x5a827999);
    b = md5Round(b, c, d, a, words[index + 0] ?? 0, 20, 0xe9b6c7aa, 19, 0x5a827999);
    a = md5Round(a, b, c, d, words[index + 5] ?? 0, 5, 0xd62f105d, 20, 0x5a827999);
    d = md5Round(d, a, b, c, words[index + 10] ?? 0, 9, 0x02441453, 21, 0x5a827999);
    c = md5Round(c, d, a, b, words[index + 15] ?? 0, 14, 0xd8a1e681, 22, 0x5a827999);
    b = md5Round(b, c, d, a, words[index + 4] ?? 0, 20, 0xe7d3fbc8, 23, 0x5a827999);
    a = md5Round(a, b, c, d, words[index + 9] ?? 0, 5, 0x21e1cde6, 24, 0x5a827999);
    d = md5Round(d, a, b, c, words[index + 14] ?? 0, 9, 0xc33707d6, 25, 0x5a827999);
    c = md5Round(c, d, a, b, words[index + 3] ?? 0, 14, 0xf4d50d87, 26, 0x5a827999);
    b = md5Round(b, c, d, a, words[index + 8] ?? 0, 20, 0x455a14ed, 27, 0x5a827999);
    a = md5Round(a, b, c, d, words[index + 13] ?? 0, 5, 0xa9e3e905, 28, 0x5a827999);
    d = md5Round(d, a, b, c, words[index + 2] ?? 0, 9, 0xfcefa3f8, 29, 0x5a827999);
    c = md5Round(c, d, a, b, words[index + 7] ?? 0, 14, 0x676f02d9, 30, 0x5a827999);
    b = md5Round(b, c, d, a, words[index + 12] ?? 0, 20, 0x8d2a4c8a, 31, 0x5a827999);

    a = md5Round(a, b, c, d, words[index + 5] ?? 0, 4, 0xfffa3942, 32, 0x6ed9eba1);
    d = md5Round(d, a, b, c, words[index + 8] ?? 0, 11, 0x8771f681, 33, 0x6ed9eba1);
    c = md5Round(c, d, a, b, words[index + 11] ?? 0, 16, 0x6d9d6122, 34, 0x6ed9eba1);
    b = md5Round(b, c, d, a, words[index + 14] ?? 0, 23, 0xfde5380c, 35, 0x6ed9eba1);
    a = md5Round(a, b, c, d, words[index + 1] ?? 0, 4, 0xa4beea44, 36, 0x6ed9eba1);
    d = md5Round(d, a, b, c, words[index + 4] ?? 0, 11, 0x4bdecfa9, 37, 0x6ed9eba1);
    c = md5Round(c, d, a, b, words[index + 7] ?? 0, 16, 0xf6bb4b60, 38, 0x6ed9eba1);
    b = md5Round(b, c, d, a, words[index + 10] ?? 0, 23, 0xbebfbc70, 39, 0x6ed9eba1);
    a = md5Round(a, b, c, d, words[index + 13] ?? 0, 4, 0x289b7ec6, 40, 0x6ed9eba1);
    d = md5Round(d, a, b, c, words[index + 0] ?? 0, 11, 0xeaa127fa, 41, 0x6ed9eba1);
    c = md5Round(c, d, a, b, words[index + 3] ?? 0, 16, 0xd4ef3085, 42, 0x6ed9eba1);
    b = md5Round(b, c, d, a, words[index + 6] ?? 0, 23, 0x04881d05, 43, 0x6ed9eba1);
    a = md5Round(a, b, c, d, words[index + 9] ?? 0, 4, 0xd9d4d039, 44, 0x6ed9eba1);
    d = md5Round(d, a, b, c, words[index + 12] ?? 0, 11, 0xe6db99e5, 45, 0x6ed9eba1);
    c = md5Round(c, d, a, b, words[index + 15] ?? 0, 16, 0x1fa27cf8, 46, 0x6ed9eba1);
    b = md5Round(b, c, d, a, words[index + 2] ?? 0, 23, 0xc4ac5665, 47, 0x6ed9eba1);

    a = md5Round(a, b, c, d, words[index + 0] ?? 0, 6, 0xf4292244, 48, 0x8f1bbcdc);
    d = md5Round(d, a, b, c, words[index + 7] ?? 0, 10, 0x432aff97, 49, 0x8f1bbcdc);
    c = md5Round(c, d, a, b, words[index + 14] ?? 0, 15, 0xab9423a7, 50, 0x8f1bbcdc);
    b = md5Round(b, c, d, a, words[index + 5] ?? 0, 21, 0xfc93a039, 51, 0x8f1bbcdc);
    a = md5Round(a, b, c, d, words[index + 12] ?? 0, 6, 0x655b59c3, 52, 0x8f1bbcdc);
    d = md5Round(d, a, b, c, words[index + 3] ?? 0, 10, 0x8f0ccc92, 53, 0x8f1bbcdc);
    c = md5Round(c, d, a, b, words[index + 10] ?? 0, 15, 0xffeff47d, 54, 0x8f1bbcdc);
    b = md5Round(b, c, d, a, words[index + 1] ?? 0, 21, 0x85845dd1, 55, 0x8f1bbcdc);
    a = md5Round(a, b, c, d, words[index + 8] ?? 0, 6, 0x6fa87e4f, 56, 0x8f1bbcdc);
    d = md5Round(d, a, b, c, words[index + 15] ?? 0, 10, 0xfe2ce6e0, 57, 0x8f1bbcdc);
    c = md5Round(c, d, a, b, words[index + 6] ?? 0, 15, 0xa3014314, 58, 0x8f1bbcdc);
    b = md5Round(b, c, d, a, words[index + 13] ?? 0, 21, 0x4e0811a1, 59, 0x8f1bbcdc);
    a = md5Round(a, b, c, d, words[index + 4] ?? 0, 6, 0xf7537e82, 60, 0x8f1bbcdc);
    d = md5Round(d, a, b, c, words[index + 11] ?? 0, 10, 0xbd3af235, 61, 0x8f1bbcdc);
    c = md5Round(c, d, a, b, words[index + 2] ?? 0, 15, 0x2ad7d2bb, 62, 0x8f1bbcdc);
    b = md5Round(b, c, d, a, words[index + 9] ?? 0, 21, 0xeb86d391, 63, 0x8f1bbcdc);

    a = addUnsigned(a, aa);
    b = addUnsigned(b, bb);
    c = addUnsigned(c, cc);
    d = addUnsigned(d, dd);
  }

  return bytesToHex(wordsToBytes([a, b, c, d]));
}

function md5Round(
  a: number,
  b: number,
  c: number,
  d: number,
  x: number,
  s: number,
  ac: number,
  round: number,
  extra: number = 0,
): number {
  let f: number;

  if (round < 16) {
    f = (b & c) | (~b & d);
  } else if (round < 32) {
    f = (d & b) | (~d & c);
  } else if (round < 48) {
    f = b ^ c ^ d;
  } else {
    f = c ^ (b | ~d);
  }

  const rotated = rotateLeft(addUnsigned(addUnsigned(a, f), addUnsigned(x, addUnsigned(ac, extra))), s);
  return addUnsigned(b, rotated);
}

function addUnsigned(left: number, right: number): number {
  const leftLow = left & 0xffff;
  const rightLow = right & 0xffff;
  const leftHigh = left >>> 16;
  const rightHigh = right >>> 16;

  const low = leftLow + rightLow;
  const carry = low >>> 16;
  const high = leftHigh + rightHigh + carry;

  return ((high & 0xffff) << 16) | (low & 0xffff);
}

function rotateLeft(value: number, bits: number): number {
  return (value << bits) | (value >>> (32 - bits));
}

function bytesToMd5Words(bytes: Uint8Array): number[] {
  const words: number[] = [];
  const byteLength = bytes.length;
  let index = 0;

  for (; index + 4 <= byteLength; index += 4) {
    words.push(
      bytes[index]
      | (bytes[index + 1] << 8)
      | (bytes[index + 2] << 16)
      | (bytes[index + 3] << 24),
    );
  }

  const remaining = byteLength - index;
  let lastWord = 0;
  for (let offset = 0; offset < remaining; offset += 1) {
    lastWord |= bytes[index + offset] << (offset * 8);
  }
  words.push(lastWord);

  const messageLengthBits = byteLength * 8;
  words.push(0x80);
  while ((words.length % 16) !== 14) {
    words.push(0);
  }
  words.push(messageLengthBits & 0xffffffff);
  words.push(Math.floor(messageLengthBits / 0x100000000));

  return words;
}

function wordsToBytes(words: number[]): Uint8Array {
  const bytes = new Uint8Array(words.length * 4);
  for (let wordIndex = 0; wordIndex < words.length; wordIndex += 1) {
    const word = words[wordIndex] ?? 0;
    const offset = wordIndex * 4;
    bytes[offset + 0] = word & 0xff;
    bytes[offset + 1] = (word >>> 8) & 0xff;
    bytes[offset + 2] = (word >>> 16) & 0xff;
    bytes[offset + 3] = (word >>> 24) & 0xff;
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
