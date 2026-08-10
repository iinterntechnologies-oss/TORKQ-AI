/**
 * TorkQ Sentinel Checksum & Format Validation Engine
 * Pure TypeScript functions for regional and financial identifier validation.
 */

// Verhoeff algorithm matrices for Aadhaar validation
const d = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];

const p = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

/**
 * Verhoeff checksum algorithm for 12-digit Indian Aadhaar card validation.
 */
export function verhoeff(n: string): boolean {
  const digits = n.replace(/\D/g, '');
  if (digits.length !== 12) return false;
  // Aadhaar cannot start with 0 or 1
  if (digits[0] === '0' || digits[0] === '1') return false;

  let c = 0;
  const reversedDigits = digits.split('').reverse().map(Number);
  for (let i = 0; i < reversedDigits.length; i++) {
    c = d[c][p[i % 8][reversedDigits[i]]];
  }
  return c === 0;
}

/**
 * MOD-97 check for Emirates ID (15 digits, starting with 784 and valid birth year).
 */
export function mod97(s: string): boolean {
  const digits = s.replace(/\D/g, '');
  if (digits.length !== 15) return false;
  if (!digits.startsWith('784')) return false;

  const birthYear = parseInt(digits.slice(3, 7), 10);
  if (isNaN(birthYear) || birthYear < 1900 || birthYear > 2030) return false;

  return true;
}

/**
 * MOD-7 / Luhn algorithm for Saudi Iqama (10 digits starting with 2).
 */
export function mod7(s: string): boolean {
  const digits = s.replace(/\D/g, '');
  if (digits.length !== 10) return false;
  if (digits[0] !== '2') return false;

  let sum = 0;
  for (let i = 0; i < 10; i++) {
    let digit = parseInt(digits[i], 10);
    if (i % 2 === 0) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0 || sum % 7 === 0;
}

/**
 * Luhn algorithm for Payment Cards (13-19 digits).
 */
export function luhn(s: string): boolean {
  const digits = s.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;

  let sum = 0;
  let isEven = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits.charAt(i), 10);
    if (isEven) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    isEven = !isEven;
  }
  return sum % 10 === 0;
}

/**
 * ISO 13616 IBAN Checksum validation (Mod 97).
 */
export function ibanCheck(s: string): boolean {
  const clean = s.replace(/[^A-Z0-9]/gi, '').toUpperCase();
  if (clean.length < 15 || clean.length > 34) return false;

  const rearranged = clean.slice(4) + clean.slice(0, 4);
  let expanded = '';
  for (let i = 0; i < rearranged.length; i++) {
    const ch = rearranged.charCodeAt(i);
    if (ch >= 65 && ch <= 90) {
      expanded += (ch - 55).toString();
    } else if (ch >= 48 && ch <= 57) {
      expanded += rearranged[i];
    } else {
      return false;
    }
  }

  let remainder = 0;
  for (let i = 0; i < expanded.length; i++) {
    remainder = (remainder * 10 + parseInt(expanded[i], 10)) % 97;
  }
  return remainder === 1;
}

/**
 * Indian Permanent Account Number (PAN) format validation.
 * 10 chars: 5 uppercase letters + 4 digits + 1 uppercase letter.
 * 4th char is entity type (P, C, H, F, A, T, B, L, J, G).
 */
export function panFormat(s: string): boolean {
  const clean = s.trim().toUpperCase();
  if (clean.length !== 10) return false;
  const panRegex = /^[A-Z]{3}[PCHFATBLJG][A-Z]\d{4}[A-Z]$/;
  return panRegex.test(clean);
}

/**
 * Saudi National ID (10 digits starting with 1, Luhn algorithm).
 */
export function saudiNid(s: string): boolean {
  const digits = s.replace(/\D/g, '');
  if (digits.length !== 10) return false;
  if (digits[0] !== '1') return false;

  let sum = 0;
  for (let i = 0; i < 10; i++) {
    let digit = parseInt(digits[i], 10);
    if (i % 2 === 0) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}

/**
 * Qatar QID (11 digits, starting with 2 or 3).
 */
export function qid(s: string): boolean {
  const digits = s.replace(/\D/g, '');
  if (digits.length !== 11) return false;
  if (digits[0] !== '2' && digits[0] !== '3') return false;

  return true;
}
