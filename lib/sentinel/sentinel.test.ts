import { describe, it, expect } from 'vitest';
import {
  verhoeff,
  mod97,
  mod7,
  luhn,
  ibanCheck,
  panFormat,
  saudiNid,
  qid,
} from './validators';
import { detectFindings, shannonEntropy } from './detectors';
import { exposureScore, getExposureBand, maskedPrompt } from './score';

describe('Sentinel Checksum Validators', () => {
  it('validates Verhoeff algorithm for Indian Aadhaar', () => {
    // Valid Aadhaar synthetic number passing Verhoeff check: 2345 6789 0124
    const validAadhaar = '2345 6789 0124';
    const invalidAadhaar = '2345 6789 0128'; // Incorrect check digit

    expect(verhoeff(validAadhaar)).toBe(true);
    expect(verhoeff(invalidAadhaar)).toBe(false);
    expect(verhoeff('012345678901')).toBe(false); // Starts with 0
  });

  it('validates MOD-97 for Emirates ID', () => {
    // Synthetic Emirates ID: 784-1990-1234569-5
    const validEid = '784-1990-1234569-5';
    expect(mod97(validEid)).toBe(true);
    expect(mod97('123-1990-1234567-1')).toBe(false); // Wrong prefix
    expect(mod97('784-1990-123456')).toBe(false); // Wrong length
  });

  it('validates MOD-7 / Luhn for Saudi Iqama', () => {
    const validIqama = '2345678903';
    expect(mod7(validIqama)).toBe(true);
    expect(mod7('1345678903')).toBe(false); // Must start with 2
  });

  it('validates Luhn algorithm for Payment Cards', () => {
    const validCard = '4111 1111 1111 1111';
    const invalidCard = '4111 1111 1111 1112';

    expect(luhn(validCard)).toBe(true);
    expect(luhn(invalidCard)).toBe(false);
  });

  it('validates ISO 13616 IBAN Checksum', () => {
    const validIban = 'GB82WEST12345698765432';
    const invalidIban = 'GB82WEST12345698765439';

    expect(ibanCheck(validIban)).toBe(true);
    expect(ibanCheck(invalidIban)).toBe(false);
  });

  it('validates Indian PAN format & entity type', () => {
    const validPan = 'ABCPD1234F'; // 4th character P = Person
    const invalidPanType = 'ABCZD1234F'; // Z is invalid entity type
    const invalidPanFormat = '12345ABCDE';

    expect(panFormat(validPan)).toBe(true);
    expect(panFormat(invalidPanType)).toBe(false);
    expect(panFormat(invalidPanFormat)).toBe(false);
  });

  it('validates Saudi National ID', () => {
    const validNid = '1088443328';
    expect(saudiNid(validNid)).toBe(true);
    expect(saudiNid('2088443328')).toBe(false); // Must start with 1
  });

  it('validates Qatar QID', () => {
    const validQid = '29012345678';
    expect(qid(validQid)).toBe(true);
    expect(qid('19012345678')).toBe(false); // Must start with 2 or 3
  });
});

describe('Sentinel Detectors Engine', () => {
  it('discards format-matching but checksum-failing values', () => {
    const promptWithFakeCard = 'Please refund order to card 4111111111111112';
    const findings = detectFindings(promptWithFakeCard);
    // Should NOT match as CREDIT_CARD because Luhn failed
    const ccFindings = findings.filter((f) => f.type === 'CREDIT_CARD');
    expect(ccFindings.length).toBe(0);
  });

  it('detects valid credit card and OpenAI API key', () => {
    const prompt = 'My key is sk-proj-1234567890abcdef1234567890abcdef123 and card is 4111111111111111';
    const findings = detectFindings(prompt);

    expect(findings.some((f) => f.type === 'API_KEY_OPENAI')).toBe(true);
    expect(findings.some((f) => f.type === 'CREDIT_CARD')).toBe(true);
  });

  it('detects Shannon entropy for raw secrets', () => {
    const highEntropy = 'aB3$f9K!mL8#p2Q&x1Z*v7W^e4R%t0Y(';
    expect(shannonEntropy(highEntropy)).toBeGreaterThan(4.0);
  });
});

describe('Tier 1 Person-Name Context & Gazetteer Detector', () => {
  it('detects person names using context triggers and gazetteer', () => {
    // 1. "hi my name is sanjay" → 1 PERSON finding, matched "sanjay"
    const f1 = detectFindings('hi my name is sanjay').filter((f) => f.type === 'PERSON');
    expect(f1.length).toBe(1);
    expect(f1[0].matched).toBe('sanjay');

    // 2. "hii my name is SANJAY" → 1 PERSON finding, matched "SANJAY"
    const f2 = detectFindings('hii my name is SANJAY').filter((f) => f.type === 'PERSON');
    expect(f2.length).toBe(1);
    expect(f2[0].matched).toBe('SANJAY');

    // 3. "My name is Sanjay" → 1 PERSON finding, matched "Sanjay"
    const f3 = detectFindings('My name is Sanjay').filter((f) => f.type === 'PERSON');
    expect(f3.length).toBe(1);
    expect(f3[0].matched).toBe('Sanjay');

    // 4. "hello Priya, please review" → 1 PERSON finding, matched "Priya"
    const f4 = detectFindings('hello Priya, please review').filter((f) => f.type === 'PERSON');
    expect(f4.length).toBe(1);
    expect(f4[0].matched).toBe('Priya');

    // 5. "regards, ahmed" → 1 PERSON finding, matched "ahmed"
    const f5 = detectFindings('regards, ahmed').filter((f) => f.type === 'PERSON');
    expect(f5.length).toBe(1);
    expect(f5[0].matched).toBe('ahmed');

    // 6. "customer: Maria Gonzalez" → 1 PERSON finding
    const f6 = detectFindings('customer: Maria Gonzalez').filter((f) => f.type === 'PERSON');
    expect(f6.length).toBe(1);
    expect(f6[0].matched).toBe('Maria Gonzalez');

    // 7. "my name is on the list" → 0 PERSON findings (stopword guard)
    const f7 = detectFindings('my name is on the list').filter((f) => f.type === 'PERSON');
    expect(f7.length).toBe(0);

    // 8. "this is urgent" → 0 PERSON findings (stopword guard)
    const f8 = detectFindings('this is urgent').filter((f) => f.type === 'PERSON');
    expect(f8.length).toBe(0);
  });

  it('correctly substitutes person name in maskedPrompt', () => {
    const prompt = 'hi my name is sanjay';
    const findings = detectFindings(prompt);
    const masked = maskedPrompt(prompt, findings);
    expect(masked).toBe('hi my name is [[PERSON_1]]');
  });

  it('catches a bare given name using the gazetteer path', () => {
    const findings = detectFindings('Please talk to sanjay about this').filter((f) => f.type === 'PERSON');
    expect(findings.length).toBe(1);
    expect(findings[0].matched).toBe('sanjay');
    expect(findings[0].confidence).toBe(0.60);
  });
});

describe('Exposure Score & Masking', () => {
  it('calculates score and band correctly', () => {
    const findings = detectFindings('API key: sk-proj-1234567890abcdef1234567890abcdef123 and email user@company.com');
    const score = exposureScore(findings);
    const band = getExposureBand(score);

    expect(score).toBeGreaterThan(30);
    expect(['SEVERE', 'CRITICAL', 'NOTABLE']).toContain(band);
  });

  it('generates masked prompt text', () => {
    const prompt = 'Contact user@example.com regarding order';
    const findings = detectFindings(prompt);
    const masked = maskedPrompt(prompt, findings);

    expect(masked).toBe('Contact [[EMAIL_1]] regarding order');
  });
});
