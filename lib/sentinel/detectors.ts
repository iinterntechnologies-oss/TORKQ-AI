import { Finding, Tier, HandlingClass } from './types';
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

/**
 * Calculates Shannon Entropy of a string to detect high-entropy secret keys.
 */
export function shannonEntropy(str: string): number {
  if (!str) return 0;
  const freq: Record<string, number> = {};
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    freq[char] = (freq[char] || 0) + 1;
  }
  let entropy = 0;
  for (const char in freq) {
    const p = freq[char] / str.length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

interface DetectorRule {
  type: string;
  label: string;
  regex: RegExp;
  tier: Tier;
  confidence: number;
  handling: HandlingClass;
  regulations: string[];
  severity: 1 | 2 | 3 | 4;
  validator?: (match: string) => boolean;
}

const TIER0_RULES: DetectorRule[] = [
  // INDIA REGIONAL
  {
    type: 'AADHAAR',
    label: 'Indian Aadhaar Card',
    regex: /\b[2-9]\d{3}[\s-]?\d{4}[\s-]?\d{4}\b/g,
    tier: 0,
    confidence: 0.98,
    handling: 'REVERSIBLE',
    regulations: ['DPDP Act 2023 s.8', 'Aadhaar Act 2016'],
    severity: 4,
    validator: verhoeff,
  },
  {
    type: 'PAN',
    label: 'Indian PAN Card',
    regex: /\b[A-Z]{3}[PCHFATBLJG][A-Z]\d{4}[A-Z]\b/g,
    tier: 0,
    confidence: 0.98,
    handling: 'REVERSIBLE',
    regulations: ['IT Act 2000', 'DPDP Act 2023'],
    severity: 3,
    validator: panFormat,
  },
  {
    type: 'GSTIN',
    label: 'Indian GSTIN Number',
    regex: /\b\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}\b/g,
    tier: 0,
    confidence: 0.95,
    handling: 'REVERSIBLE',
    regulations: ['GST Rules 2017'],
    severity: 2,
  },
  {
    type: 'IFSC',
    label: 'Indian Bank IFSC Code',
    regex: /\b[A-Z]{4}0[A-Z0-9]{6}\b/g,
    tier: 0,
    confidence: 0.95,
    handling: 'PRESERVE',
    regulations: ['RBI Payment Security'],
    severity: 2,
  },
  {
    type: 'UPI_VPA',
    label: 'UPI Payment ID',
    regex: /\b[a-zA-Z0-9._-]+@(upi|ybl|okicici|oksbi|okaxis|paytm|apl|icici|sbi|axis|hdfcbank)\b/gi,
    tier: 0,
    confidence: 0.96,
    handling: 'REVERSIBLE',
    regulations: ['NPCI / RBI Security Standards'],
    severity: 3,
  },
  {
    type: 'INDIAN_MOBILE',
    label: 'Indian Mobile Number',
    regex: /\b(?:\+91[\s-]?)?[6-9]\d{9}\b/g,
    tier: 0,
    confidence: 0.95,
    handling: 'REVERSIBLE',
    regulations: ['DPDP Act 2023', 'TRAI Regulations'],
    severity: 2,
  },

  // GULF REGIONAL
  {
    type: 'EMIRATES_ID',
    label: 'Emirates ID',
    regex: /\b784[-\s]?\d{4}[-\s]?\d{7}[-\s]?\d\b/g,
    tier: 0,
    confidence: 0.99,
    handling: 'REVERSIBLE',
    regulations: ['UAE Federal Decree-Law No. 45/2021'],
    severity: 4,
    validator: mod97,
  },
  {
    type: 'IQAMA',
    label: 'Saudi Iqama ID',
    regex: /\b2\d{9}\b/g,
    tier: 0,
    confidence: 0.97,
    handling: 'REVERSIBLE',
    regulations: ['KSA PDPL Article 4'],
    severity: 4,
    validator: mod7,
  },
  {
    type: 'SAUDI_NID',
    label: 'Saudi National ID',
    regex: /\b1\d{9}\b/g,
    tier: 0,
    confidence: 0.97,
    handling: 'REVERSIBLE',
    regulations: ['KSA PDPL Article 4'],
    severity: 4,
    validator: saudiNid,
  },
  {
    type: 'QATAR_QID',
    label: 'Qatar National ID (QID)',
    regex: /\b[23]\d{10}\b/g,
    tier: 0,
    confidence: 0.97,
    handling: 'REVERSIBLE',
    regulations: ['Qatar Law No. 13 of 2016'],
    severity: 4,
    validator: qid,
  },

  // FINANCIAL & SECRETS
  {
    type: 'CREDIT_CARD',
    label: 'Payment Card Number',
    regex: /\b(?:\d[ -]*?){13,19}\b/g,
    tier: 0,
    confidence: 0.99,
    handling: 'BLOCK',
    regulations: ['PCI-DSS v4.0'],
    severity: 4,
    validator: luhn,
  },
  {
    type: 'IBAN',
    label: 'IBAN Bank Account',
    regex: /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/g,
    tier: 0,
    confidence: 0.98,
    handling: 'REVERSIBLE',
    regulations: ['PCI-DSS', 'SWIFT Guidelines'],
    severity: 3,
    validator: ibanCheck,
  },
  {
    type: 'API_KEY_OPENAI',
    label: 'OpenAI Secret Key',
    regex: /\bsk-(?:proj-)?[a-zA-Z0-9\-_]{20,}\b/g,
    tier: 0,
    confidence: 0.99,
    handling: 'BLOCK',
    regulations: ['SOC2 Type II', 'ISO 27001'],
    severity: 4,
  },
  {
    type: 'API_KEY_ANTHROPIC',
    label: 'Anthropic Secret Key',
    regex: /\bsk-ant-[a-zA-Z0-9\-_]{32,}\b/g,
    tier: 0,
    confidence: 0.99,
    handling: 'BLOCK',
    regulations: ['SOC2 Type II', 'ISO 27001'],
    severity: 4,
  },
  {
    type: 'GITHUB_TOKEN',
    label: 'GitHub Access Token',
    regex: /\bghp_[a-zA-Z0-9]{36}\b/g,
    tier: 0,
    confidence: 0.99,
    handling: 'BLOCK',
    regulations: ['SOC2 Type II', 'ISO 27001'],
    severity: 4,
  },
  {
    type: 'AWS_ACCESS_KEY',
    label: 'AWS Access Key ID',
    regex: /\bAKIA[0-9A-Z]{16}\b/g,
    tier: 0,
    confidence: 0.99,
    handling: 'BLOCK',
    regulations: ['SOC2 Type II', 'AWS Security Best Practices'],
    severity: 4,
  },
  {
    type: 'SLACK_TOKEN',
    label: 'Slack Bot Token',
    regex: /\bxoxb-[0-9]{10,}-[0-9]{10,}-[a-zA-Z0-9]{24}\b/g,
    tier: 0,
    confidence: 0.99,
    handling: 'BLOCK',
    regulations: ['SOC2 Type II'],
    severity: 4,
  },
  {
    type: 'JWT_TOKEN',
    label: 'JSON Web Token (JWT)',
    regex: /\beyJ[a-zA-Z0-9\-_]+\.eyJ[a-zA-Z0-9\-_]+\.[a-zA-Z0-9\-_]+\b/g,
    tier: 0,
    confidence: 0.98,
    handling: 'BLOCK',
    regulations: ['OWASP Top 10', 'SOC2'],
    severity: 4,
  },
  {
    type: 'PEM_PRIVATE_KEY',
    label: 'PEM Private Key',
    regex: /-----BEGIN (?:RSA )?PRIVATE KEY-----[\s\S]+?-----END (?:RSA )?PRIVATE KEY-----/g,
    tier: 0,
    confidence: 1.0,
    handling: 'BLOCK',
    regulations: ['ISO 27001', 'SOC2'],
    severity: 4,
  },

  // GENERIC PII
  {
    type: 'EMAIL',
    label: 'Email Address',
    regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    tier: 0,
    confidence: 0.98,
    handling: 'REVERSIBLE',
    regulations: ['GDPR Art. 4', 'DPDP Act 2023'],
    severity: 2,
  },
  {
    type: 'IPV4',
    label: 'IPv4 Address',
    regex: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
    tier: 0,
    confidence: 0.96,
    handling: 'REVERSIBLE',
    regulations: ['GDPR Art. 4'],
    severity: 2,
  },
  {
    type: 'IPV6',
    label: 'IPv6 Address',
    regex: /\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b/g,
    tier: 0,
    confidence: 0.96,
    handling: 'REVERSIBLE',
    regulations: ['GDPR Art. 4'],
    severity: 2,
  },
  {
    type: 'US_SSN',
    label: 'US Social Security Number',
    regex: /\b(?!000|666|9\d{2})\d{3}[-\s]?(?!00)\d{2}[-\s]?(?!0000)\d{4}\b/g,
    tier: 0,
    confidence: 0.95,
    handling: 'BLOCK',
    regulations: ['US Privacy Act 1974', 'HIPAA'],
    severity: 4,
  },
  {
    type: 'URL_CREDENTIALS',
    label: 'URL with Embedded Password',
    regex: /\bhttps?:\/\/[a-zA-Z0-9_]+:[a-zA-Z0-9_]+@[a-zA-Z0-9.-]+\b/g,
    tier: 0,
    confidence: 0.98,
    handling: 'BLOCK',
    regulations: ['OWASP Security Standard'],
    severity: 4,
  },
];

/**
 * Stopwords list to prevent false positive name capture on common English terms.
 */
const STOPWORDS = new Set([
  // Pronouns, articles, prepositions
  'a', 'an', 'the', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
  'my', 'your', 'his', 'her', 'its', 'our', 'their', 'mine', 'yours', 'hers', 'ours', 'theirs',
  'this', 'that', 'these', 'those', 'who', 'whom', 'whose', 'which', 'what',
  'in', 'on', 'at', 'by', 'for', 'with', 'about', 'against', 'between', 'into', 'through',
  'during', 'before', 'after', 'above', 'below', 'to', 'from', 'up', 'down', 'out', 'off',
  'over', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where',
  'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some',
  'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very',

  // Conjunctions & auxiliaries
  'and', 'but', 'if', 'or', 'because', 'as', 'until', 'while', 'of',
  'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'having', 'do', 'does', 'did', 'doing',
  'can', 'could', 'would', 'should', 'shall', 'will', 'may', 'might', 'must',

  // Common non-name words / adjectives / status words
  'urgent', 'important', 'required', 'available', 'ready', 'notified', 'confirmed',
  'pending', 'null', 'undefined', 'none', 'na', 'unknown', 'test', 'user', 'admin',
  'please', 'kindly', 'thanks', 'regards', 'hello', 'hi', 'hey', 'dear',
  'list', 'file', 'data', 'record', 'system', 'process', 'page', 'site', 'app',
  'code', 'error', 'issue', 'bug', 'status', 'state', 'type', 'name', 'value',
  'item', 'items', 'group', 'team', 'company', 'organization', 'dept', 'department',
  'info', 'information', 'details', 'note', 'notes', 'message', 'email', 'phone',
  'number', 'address', 'card', 'id', 'key', 'token', 'pass', 'password', 'secret',
  'today', 'tomorrow', 'yesterday', 'now', 'soon', 'later', 'here', 'there',
  'first', 'second', 'third', 'last', 'next', 'previous', 'new', 'old', 'good', 'bad'
]);

/**
 * Case-insensitive given-name gazetteer containing >200 common Indian, Arabic, and Western given names.
 */
const GIVEN_NAMES = new Set([
  // --- Indian Given Names ---
  'sanjay', 'priya', 'rajesh', 'rahul', 'ananya', 'amit', 'rohan', 'pooja', 'vikram', 'neha',
  'sunil', 'kiran', 'deepak', 'arjun', 'kavita', 'anil', 'swati', 'manish', 'divya', 'aarti',
  'alok', 'archana', 'ashok', 'bhavesh', 'chaitanya', 'deepa', 'ganesh', 'gaurav', 'harish', 'ishita',
  'jitendra', 'jyoti', 'karthik', 'madhavi', 'meena', 'mukesh', 'nisha', 'pankaj', 'pradeep', 'radha',
  'rakesh', 'ramesh', 'ritu', 'sachin', 'sameer', 'sandeep', 'sharma', 'shiv', 'sneha', 'sonia',
  'suresh', 'tarun', 'ujwal', 'vaishali', 'varun', 'vinod', 'yash', 'aditi', 'aakash', 'abhishek',
  'ajay', 'akhil', 'amrita', 'anand', 'anita', 'ankita', 'aparna', 'arun', 'avinash', 'balaji',
  'bharat', 'chandan', 'darshan', 'devendra', 'dinesh', 'divyansh', 'gautam', 'girish', 'harsh', 'hemant',
  'indrajit', 'jagdish', 'jay', 'karan', 'kaushik', 'lalit', 'mahesh', 'mohit', 'naveen', 'nilesh',
  'nitin', 'parth', 'payal', 'prashant', 'pravin', 'preeti', 'raghav', 'raj', 'rajan', 'rajiv',
  'rashmi', 'ravi', 'reena', 'rishabh', 'rohit', 'rubi', 'samarth', 'sanjeev', 'shalini', 'shankar',
  'shilpa', 'shivam', 'shreya', 'siddharth', 'simran', 'sonal', 'sumit', 'sunita', 'tanvi', 'utkarsh',
  'vandana', 'vedant', 'vikas', 'vimal', 'vinay', 'vivek', 'aishwarya', 'akash', 'alpa', 'aman',

  // --- Arabic Given Names ---
  'ahmed', 'mohammed', 'muhammad', 'ali', 'omar', 'hassan', 'hussein', 'ibrahim', 'tariq', 'khaled',
  'youssef', 'zain', 'fatima', 'aisha', 'mariam', 'layla', 'noor', 'sarah', 'zahra', 'hamza',
  'bilal', 'amir', 'kamal', 'rashid', 'saeed', 'salim', 'waleed', 'yasmin', 'zaid', 'abdullah',
  'abdul', 'adnan', 'ahsan', 'akram', 'ala', 'aliya', 'amin', 'amina', 'amjad', 'anas',
  'asim', 'aya', 'ayman', 'bassam', 'farid', 'habib', 'hadi', 'hani', 'hatem', 'imran',
  'karim', 'mahmoud', 'majid', 'malik', 'mansour', 'marwan', 'moustafa', 'mustafa', 'nabil', 'nadia',
  'naim', 'nasser', 'nawaf', 'nizar', 'osama', 'qasim', 'rami', 'rania', 'rayan', 'reem',
  'riaz', 'saad', 'sabir', 'salah', 'sami', 'samir', 'sana', 'soraya', 'taha', 'wael',
  'yahya', 'yousef', 'ziad', 'faisal', 'habiba', 'hamad', 'idris', 'ikram', 'khadija', 'latifa',

  // --- Western Given Names ---
  'maria', 'john', 'james', 'robert', 'michael', 'william', 'david', 'richard', 'joseph', 'thomas',
  'charles', 'christopher', 'daniel', 'matthew', 'anthony', 'mark', 'donald', 'steven', 'paul', 'andrew',
  'joshua', 'kenneth', 'kevin', 'brian', 'george', 'edward', 'ronald', 'timothy', 'jason', 'jeffrey',
  'ryan', 'jacob', 'gary', 'nicholas', 'eric', 'jonathan', 'stephen', 'larry', 'justin', 'scott',
  'brendan', 'mary', 'patricia', 'jennifer', 'linda', 'elizabeth', 'barbara', 'susan', 'jessica', 'karen',
  'lisa', 'nancy', 'betty', 'margaret', 'sandra', 'ashley', 'kimberly', 'emily', 'donna', 'michelle',
  'carol', 'amanda', 'melissa', 'deborah', 'stephanie', 'rebecca', 'sharon', 'laura', 'cynthia', 'kathleen',
  'amy', 'angela', 'shirley', 'anna', 'brenda', 'pamela', 'emma', 'nicole', 'helen', 'samantha',
  'katherine', 'christine', 'debra', 'rachel', 'carolyn', 'janet', 'catherine', 'gonzalez', 'alex', 'alexander',
  'alice', 'benjamin', 'charlotte', 'ethan', 'graciela', 'hannah', 'henry', 'isabella', 'jack', 'lucas',
  'mia', 'oliver', 'sophia', 'victoria', 'adam', 'alan', 'albert', 'amber', 'austin', 'brandon',
  'bryan', 'carl', 'christian', 'dylan', 'eugene', 'gabriel', 'gregory', 'harold', 'jerry', 'jordan',
  'juan', 'logan', 'louis', 'nathan', 'ralph', 'raymond', 'roy', 'samuel', 'terry', 'tyler',
  'wayne', 'zachary'
]);

/**
  Trigger phrases for context-trigger detector.
*/
const PERSON_TRIGGERS = [
  /\bmy\s+name\s+is\b/gi,
  /\bi\s+am\b/gi,
  /\bi'?m\b/gi,
  /\bthis\s+is\b/gi,
  /\bname\s*:\s*/gi,
  /\bdear\b/gi,
  /\bhii*\b/gi,
  /\bhello\b/gi,
  /\bhey\b/gi,
  /\bregards\s*,?\s*/gi,
  /\bsincerely\s*,?\s*/gi,
  /\bthanks\s*,?\s*/gi,
  /\bbest\s*,?\s*/gi,
  /\bcc\s*:?\s*/gi,
  /\battn\s*:?\s*/gi,
  /\bcustomer\s*:?\s*/gi,
  /\bclient\s*:?\s*/gi,
  /\bemployee\s*:?\s*/gi,
  /\bpatient\s*:?\s*/gi,
  /\bcandidate\s*:?\s*/gi,
  /\bcontact\b/gi,
  /\bspeak\s+to\b/gi,
  /\breach\s+out\s+to\b/gi,
  /\bforwarded\s+to\b/gi,
];

/**
 * Heuristic Tier 1 detectors (confidence 0.55-0.75).
 * Uses pattern matching, context windows, and dictionary terms.
 */
function detectTier1(text: string): Finding[] {
  const findings: Finding[] = [];
  let match: RegExpExecArray | null;

  // 1. Person Names — Context Trigger Detector (Confidence 0.80)
  for (const regex of PERSON_TRIGGERS) {
    regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const triggerEnd = match.index + match[0].length;

      // Advance cursor past initial whitespace
      let cursor = triggerEnd;
      while (cursor < text.length && /\s/.test(text[cursor])) {
        cursor++;
      }

      const capturedTokens: { word: string; start: number; end: number }[] = [];

      for (let step = 0; step < 3; step++) {
        if (cursor >= text.length) break;

        const char = text[cursor];
        if (!/[a-zA-Z]/.test(char)) {
          // Punctuation or digit or special char stops token capture
          break;
        }

        // Match word token starting at cursor
        const tokenMatch = text.slice(cursor).match(/^[a-zA-Z]+(?:['\-][a-zA-Z]+)*/);
        if (!tokenMatch) break;

        const word = tokenMatch[0];
        const tokenStart = cursor;
        const tokenEnd = cursor + word.length;

        // Check stopword guard
        if (STOPWORDS.has(word.toLowerCase())) {
          // Stop immediately on stopword
          break;
        }

        capturedTokens.push({ word, start: tokenStart, end: tokenEnd });
        cursor = tokenEnd;

        // Check character right after token
        if (cursor < text.length) {
          const nextChar = text[cursor];
          if (/[^\w\s]/.test(nextChar) || /\d/.test(nextChar)) {
            // Stop at punctuation or digit
            break;
          }
          if (nextChar === ' ' || nextChar === '\t') {
            cursor++;
            if (cursor < text.length && (/\s/.test(text[cursor]) || /[^\w\s]/.test(text[cursor]) || /\d/.test(text[cursor]))) {
              break;
            }
          } else {
            break;
          }
        }
      }

      if (capturedTokens.length > 0) {
        const startOffset = capturedTokens[0].start;
        const endOffset = capturedTokens[capturedTokens.length - 1].end;
        const matchedStr = text.slice(startOffset, endOffset);

        findings.push({
          id: `t1-person-trigger-${startOffset}`,
          type: 'PERSON',
          label: 'Person Name (Context Trigger)',
          start: startOffset,
          end: endOffset,
          matched: matchedStr,
          confidence: 0.80,
          tier: 1,
          handling: 'REVERSIBLE',
          regulations: ['DPDP Act 2023 s.2(t)', 'GDPR Art.4(1)'],
          severity: 2,
          dismissed: false,
        });
      }
    }
  }

  // 2. Person Names — Given-Name Gazetteer (Confidence 0.60)
  const wordRegex = /\b[a-zA-Z]{2,}\b/g;
  let wordMatch: RegExpExecArray | null;
  while ((wordMatch = wordRegex.exec(text)) !== null) {
    const rawWord = wordMatch[0];
    const lowerWord = rawWord.toLowerCase();
    if (GIVEN_NAMES.has(lowerWord)) {
      findings.push({
        id: `t1-person-gazetteer-${wordMatch.index}`,
        type: 'PERSON',
        label: 'Person Name (Gazetteer)',
        start: wordMatch.index,
        end: wordMatch.index + rawWord.length,
        matched: rawWord,
        confidence: 0.60,
        tier: 1,
        handling: 'REVERSIBLE',
        regulations: ['DPDP Act 2023 s.2(t)', 'GDPR Art.4(1)'],
        severity: 2,
        dismissed: false,
      });
    }
  }

  // 2. Organization Names (e.g., Acme Corp, Tech Solutions LLC)
  const orgRegex = /\b([A-Z][a-zA-Z0-9&]+\s+(?:Corp|Corporation|Inc|LLC|Pvt Ltd|Limited|Technologies|Bank|Services|Group))\b/g;
  while ((match = orgRegex.exec(text)) !== null) {
    findings.push({
      id: `t1-org-${match.index}`,
      type: 'ORGANIZATION_NAME',
      label: 'Organization Name (Heuristic)',
      start: match.index,
      end: match.index + match[0].length,
      matched: match[0],
      confidence: 0.60,
      tier: 1,
      handling: 'REVERSIBLE',
      regulations: ['Commercial Confidentiality'],
      severity: 1,
      dismissed: false,
    });
  }

  // 3. Job Title + Salary / Compensation (e.g. Salary: $120,000, CTC: 15 LPA, AED 45,000)
  const salaryRegex = /\b(?:salary|ctc|compensation|annual pay|remuneration)[:\s]+(?:[\$\u20B9]|AED|SAR|USD)?\s*([0-9,]+(?:\s*(?:k|LPA|AED|SAR|USD))?)\b/gi;
  while ((match = salaryRegex.exec(text)) !== null) {
    findings.push({
      id: `t1-salary-${match.index}`,
      type: 'SALARY_DATA',
      label: 'Compensation Details (Heuristic)',
      start: match.index,
      end: match.index + match[0].length,
      matched: match[0],
      confidence: 0.70,
      tier: 1,
      handling: 'REVERSIBLE',
      regulations: ['Internal HR Policy'],
      severity: 2,
      dismissed: false,
    });
  }

  // 4. Medical / Health Terms (e.g. diagnosis, medical record, prescribed, symptoms)
  const medicalRegex = /\b(?:diagnosis|patient|prescribed|medical record|blood pressure|symptoms|ICD-10|treatment plan)[:\s]+([^.,\n]+)\b/gi;
  while ((match = medicalRegex.exec(text)) !== null) {
    findings.push({
      id: `t1-medical-${match.index}`,
      type: 'HEALTH_RECORD',
      label: 'Health / Medical Record (Heuristic)',
      start: match.index,
      end: match.index + match[0].length,
      matched: match[0],
      confidence: 0.70,
      tier: 1,
      handling: 'BLOCK',
      regulations: ['HIPAA', 'DPDP Act 2023 Health Clause'],
      severity: 3,
      dismissed: false,
    });
  }

  // 5. Legal / Confidentiality References
  const legalRegex = /\b(?:Privileged & Confidential|NDA|Non-Disclosure Agreement|Proprietary & Confidential|Trade Secret)\b/gi;
  while ((match = legalRegex.exec(text)) !== null) {
    findings.push({
      id: `t1-legal-${match.index}`,
      type: 'LEGAL_CONFIDENTIAL',
      label: 'Legal / NDA Clause (Heuristic)',
      start: match.index,
      end: match.index + match[0].length,
      matched: match[0],
      confidence: 0.65,
      tier: 1,
      handling: 'PRESERVE',
      regulations: ['Legal Privilege'],
      severity: 2,
      dismissed: false,
    });
  }

  return findings;
}

/**
 * Generic High Entropy Secret Detector (Tier 0).
 */
function detectHighEntropySecrets(text: string): Finding[] {
  const findings: Finding[] = [];
  // Tokenize candidate strings of length >= 32 with no whitespace
  const tokenRegex = /\b[a-zA-Z0-9\-_=]{32,128}\b/g;
  let match: RegExpExecArray | null;
  while ((match = tokenRegex.exec(text)) !== null) {
    const candidate = match[0];
    const entropy = shannonEntropy(candidate);
    if (entropy > 4.0) {
      findings.push({
        id: `t0-entropy-${match.index}`,
        type: 'HIGH_ENTROPY_SECRET',
        label: 'High-Entropy Secret Key',
        start: match.index,
        end: match.index + candidate.length,
        matched: candidate,
        confidence: 0.95,
        tier: 0,
        handling: 'BLOCK',
        regulations: ['SOC2 Type II', 'ISO 27001'],
        severity: 4,
        dismissed: false,
      });
    }
  }
  return findings;
}

/**
 * Resolves overlapping findings:
 * 1. Tier 0 wins over Tier 1
 * 2. Longer span length wins
 * 3. Higher confidence wins
 */
export function resolveSpans(findings: Finding[]): Finding[] {
  if (findings.length <= 1) return findings;

  // Sort by priority rules:
  // Tier asc (0 first), Span length desc, Confidence desc, Start asc
  const sorted = [...findings].sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    const lenA = a.end - a.start;
    const lenB = b.end - b.start;
    if (lenA !== lenB) return lenB - lenA;
    if (a.confidence !== b.confidence) return b.confidence - a.confidence;
    return a.start - b.start;
  });

  const kept: Finding[] = [];

  for (const candidate of sorted) {
    let overlaps = false;
    for (const existing of kept) {
      // Check interval overlap: max(start) < min(end)
      if (Math.max(candidate.start, existing.start) < Math.min(candidate.end, existing.end)) {
        overlaps = true;
        break;
      }
    }
    if (!overlaps) {
      kept.push(candidate);
    }
  }

  // Return sorted by start position
  return kept.sort((a, b) => a.start - b.start);
}

/**
 * Main detection pipeline for TorkQ Sentinel Engine.
 * Scans input text and returns non-overlapping findings.
 */
export function detectFindings(text: string): Finding[] {
  if (!text || text.trim() === '') return [];

  const rawFindings: Finding[] = [];

  // Run Tier 0 Regex Rules
  for (const rule of TIER0_RULES) {
    // Reset regex index
    rule.regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = rule.regex.exec(text)) !== null) {
      const matchedStr = match[0];
      // Run checksum validator if attached
      if (rule.validator && !rule.validator(matchedStr)) {
        // Discard failed checksum hit
        continue;
      }

      rawFindings.push({
        id: `t0-${rule.type}-${match.index}`,
        type: rule.type,
        label: rule.label,
        start: match.index,
        end: match.index + matchedStr.length,
        matched: matchedStr,
        confidence: rule.confidence,
        tier: rule.tier,
        handling: rule.handling,
        regulations: rule.regulations,
        severity: rule.severity,
        dismissed: false,
      });
    }
  }

  // Run High Entropy Secrets Detector
  const entropySecrets = detectHighEntropySecrets(text);
  rawFindings.push(...entropySecrets);

  // Run Tier 1 Heuristic Rules
  const tier1Findings = detectTier1(text);
  rawFindings.push(...tier1Findings);

  // Resolve overlapping spans
  return resolveSpans(rawFindings);
}
