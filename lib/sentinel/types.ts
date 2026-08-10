export type Tier = 0 | 1;
export type HandlingClass = 'REVERSIBLE' | 'PRESERVE' | 'BLOCK';

export interface Finding {
  id: string;
  type: string;            // 'AADHAAR', 'API_KEY', 'EMIRATES_ID', etc.
  label: string;           // Human-readable title
  start: number;           // Char start offset in prompt
  end: number;             // Char end offset
  matched: string;         // Raw matched string
  confidence: number;      // 0..1
  tier: Tier;
  handling: HandlingClass;
  regulations: string[];   // e.g. ['DPDP Act 2023 s.8']
  severity: 1 | 2 | 3 | 4; // 1 = low, 4 = critical
  dismissed: boolean;
}
