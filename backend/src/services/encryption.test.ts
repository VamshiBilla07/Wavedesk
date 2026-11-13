import { describe, it, expect, beforeEach } from 'vitest';
import { encrypt, decrypt, mask } from './encryption';

const TEST_KEY_1 = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const TEST_KEY_2 = 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';

describe('Encryption Service', () => {
  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY_1;
  });

  it('performs a successful round trip encryption and decryption', () => {
    const plain = 'EAAGNOtYsampleTokenSecret1234567890';
    const encrypted = encrypt(plain);

    expect(encrypted).toMatch(/^v1:[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/);
    expect(encrypted).not.toContain(plain);

    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(plain);
  });

  it('detects tampering with ciphertext and throws an error', () => {
    const plain = 'Sensitive Meta WhatsApp Access Token';
    const encrypted = encrypt(plain);
    const parts = encrypted.split(':');

    // Tamper with the ciphertext component
    const tamperedCipher =
      parts[3].slice(0, -2) + (parts[3].endsWith('a') ? 'b' : 'a');
    const tampered = `${parts[0]}:${parts[1]}:${parts[2]}:${tamperedCipher}`;

    expect(() => decrypt(tampered)).toThrow();
  });

  it('detects tampering with auth tag and throws an error', () => {
    const plain = 'Sensitive Meta WhatsApp Access Token';
    const encrypted = encrypt(plain);
    const parts = encrypted.split(':');

    // Tamper with the auth tag by altering the last byte (2 hex characters)
    const lastByte = parts[2].slice(-2);
    const newLastByte = lastByte === 'aa' ? 'bb' : 'aa';
    const tamperedTag = parts[2].slice(0, -2) + newLastByte;
    const tampered = `${parts[0]}:${parts[1]}:${tamperedTag}:${parts[3]}`;

    expect(() => decrypt(tampered)).toThrow();
  });

  it('fails decryption when decrypted with a different key', () => {
    const plain = 'Secret Meta App Secret';
    const encrypted = encrypt(plain);

    process.env.ENCRYPTION_KEY = TEST_KEY_2;
    expect(() => decrypt(encrypted)).toThrow();
  });

  it('throws when payload format or version is invalid', () => {
    expect(() => decrypt('invalid-payload')).toThrow('Invalid encrypted payload format');
    expect(() => decrypt('v2:iv:tag:cipher')).toThrow('Unsupported encryption version: v2');
  });

  it('masks sensitive strings properly', () => {
    expect(mask('EAAB1234567890wxyz')).toBe('EAAB••••••••wxyz');
    expect(mask('short')).toBe('••••••••');
    expect(mask('')).toBe('');
    expect(mask(null)).toBe('');
    expect(mask(undefined)).toBe('');
  });
});
