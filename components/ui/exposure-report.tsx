import React, { useState, useEffect, useRef } from 'react';
import { useReducedMotion } from 'framer-motion';
import { Finding, maskedPrompt, getExposureBand } from '../../lib/sentinel';

interface ExposureReportProps {
  promptText: string;
  findings: Finding[];
  score: number;
  onDismissFinding: (id: string) => void;
  onRemediate: () => void;
}

const getCategoryForType = (type: string): string => {
  if (type.includes('AADHAAR') || type.includes('EMIRATES') || type.includes('QID') || type.includes('SAUDI') || type.includes('PAN')) {
    return 'National & Regional Identifiers';
  }
  if (type.includes('CREDIT') || type.includes('IBAN')) {
    return 'Financial Identifiers';
  }
  if (type.includes('API_KEY') || type.includes('TOKEN') || type.includes('SECRET')) {
    return 'API Keys & Secrets';
  }
  if (type.includes('EMAIL') || type.includes('PHONE') || type.includes('IP')) {
    return 'PII & Contact Info';
  }
  return 'General Identifiers';
};

export const ExposureReport: React.FC<ExposureReportProps> = ({
  promptText,
  findings,
  score,
  onDismissFinding,
  onRemediate,
}) => {
  const [displayScore, setDisplayScore] = useState(0);
  const [hoveredFinding, setHoveredFinding] = useState<Finding | null>(null);
  const [hasTriggeredScrollRemediation, setHasTriggeredScrollRemediation] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const displayScoreRef = useRef(0);
  const prefersReducedMotion = useReducedMotion();

  // Score Count-Up Animation
  useEffect(() => {
    if (prefersReducedMotion) {
      displayScoreRef.current = score;
      setDisplayScore(score);
      return;
    }

    // Start from the value currently on screen, never from zero. Re-targeting
    // mid-count (dismissing a finding) has to continue from where the number
    // actually is, or it visibly snaps back to 0 and re-counts.
    const start = displayScoreRef.current;
    const duration = 800;
    const startTime = performance.now();
    let frame = 0;

    const animate = (now: number) => {
      const progress = Math.min(1, (now - startTime) / duration);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const value = Math.round(start + (score - start) * easeOut);

      displayScoreRef.current = value;
      setDisplayScore(value);

      if (progress < 1) {
        frame = requestAnimationFrame(animate);
      }
    };

    frame = requestAnimationFrame(animate);
    // Without this, a score change mid-count leaves two loops racing to set state.
    return () => cancelAnimationFrame(frame);
  }, [score, prefersReducedMotion]);

  // Scroll to bottom trigger for remediation
  useEffect(() => {
    if (!bottomRef.current || hasTriggeredScrollRemediation) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setHasTriggeredScrollRemediation(true);
          onRemediate();
        }
      },
      { threshold: 0.5 }
    );

    observer.observe(bottomRef.current);
    return () => observer.disconnect();
  }, [hasTriggeredScrollRemediation, onRemediate]);

  const activeFindings = findings.filter((f) => !f.dismissed);
  const band = getExposureBand(score);

  // Group findings by category
  const groupedFindings: Record<string, Finding[]> = activeFindings.reduce((acc, f) => {
    const category = getCategoryForType(f.type);
    if (!acc[category]) acc[category] = [];
    acc[category].push(f);
    return acc;
  }, {} as Record<string, Finding[]>);

  // Redacted preview generator (FIRST 2 AND LAST 2 CHARS ONLY)
  const getRedactedPreview = (matched: string) => {
    const clean = matched.trim();
    if (clean.length <= 4) return '****';
    const first2 = clean.slice(0, 2);
    const last2 = clean.slice(-2);
    return `${first2}...${last2}`;
  };

  // Regulatory Mapping Logic
  const regMap: Record<string, { name: string; section: string; count: number }> = {
    'DPDP Act 2023': { name: 'DPDP Act 2023', section: 's.8(5) — Obligations of Data Fiduciary', count: 0 },
    'RBI IT Framework': { name: 'RBI IT Framework', section: 'Cl. 3.2 — Protection of Financial Data', count: 0 },
    'GDPR': { name: 'EU GDPR', section: 'Art. 4(1) & Art. 32 — Security of PII Processing', count: 0 },
    'UAE PDPL': { name: 'UAE PDPL', section: 'Art. 13 — Cross-Border Data Transfer Rules', count: 0 },
    'ISO 42001': { name: 'ISO/IEC 42001', section: 'Control A.6.2 — AI Data Privacy Controls', count: 0 },
  };

  activeFindings.forEach((f) => {
    f.regulations.forEach((reg) => {
      Object.keys(regMap).forEach((key) => {
        if (reg.includes(key) || key.includes(reg)) {
          regMap[key].count++;
        }
      });
    });
  });

  const implicatedRegs = Object.values(regMap).filter((r) => r.count > 0);

  // Annotated Prompt Renderer with Red Highlight Spans
  const renderAnnotatedPrompt = () => {
    if (!promptText) return null;
    if (activeFindings.length === 0) {
      return (
        <span className="text-[#6DBE30] font-mono text-sm">
          {promptText}
        </span>
      );
    }

    const sorted = [...activeFindings].sort((a, b) => a.start - b.start);
    const chunks: React.ReactNode[] = [];
    let lastIndex = 0;

    sorted.forEach((finding, idx) => {
      if (finding.start > lastIndex) {
        chunks.push(
          <span key={`text-${lastIndex}`}>
            {promptText.slice(lastIndex, finding.start)}
          </span>
        );
      }

      const sliceText = promptText.slice(finding.start, finding.end);
      chunks.push(
        <span
          key={`finding-${finding.id}-${idx}`}
          onMouseEnter={() => setHoveredFinding(finding)}
          onMouseLeave={() => setHoveredFinding(null)}
          tabIndex={0}
          role="button"
          aria-label={`Finding: ${finding.label}`}
          className={`relative inline-block px-1.5 py-0.5 mx-0.5 rounded cursor-pointer font-mono font-bold transition-colors duration-150 border ${
            finding.tier === 1
              ? 'bg-amber-500/20 text-amber-200 border-amber-500/40 hover:bg-amber-500/30 ring-1 ring-amber-500/30'
              : 'bg-red-500/25 text-red-200 border-red-500/50 hover:bg-red-500/35 ring-1 ring-red-500/40'
          }`}
        >
          {sliceText}
          <span className="ml-1 px-1 py-0.5 rounded text-[9px] uppercase bg-black/50 border border-white/20 text-white">
            [{finding.type}]
          </span>
        </span>
      );

      lastIndex = Math.max(lastIndex, finding.end);
    });

    if (lastIndex < promptText.length) {
      chunks.push(
        <span key={`text-end-${lastIndex}`}>
          {promptText.slice(lastIndex)}
        </span>
      );
    }

    return chunks;
  };

  const receiptHash = React.useMemo(() => {
    let hash = 0;
    const str = promptText + findings.length;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(12, '0');
  }, [promptText, findings]);

  return (
    <div data-reveal className="w-full max-w-[900px] mx-auto space-y-8 font-sans animate-fade-in">
      {/* SECTION 1: SCORE & BAND HEADER */}
      <div
        data-material="panel"
        className="rounded-2xl border border-white/10 bg-black/50 backdrop-blur-xl p-6 sm:p-8 space-y-4 text-center relative overflow-hidden shadow-2xl"
      >
        <div className="space-y-1">
          <div className="text-xs font-mono uppercase tracking-widest text-neutral-400">
            // Exposure Assessment Report
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <span
              className="font-mono text-5xl sm:text-6xl font-black tracking-display leading-display"
              style={{
                color:
                  displayScore > 65
                    ? '#f87171'
                    : displayScore > 35
                    ? '#fbbf24'
                    : displayScore > 0
                    ? '#34d399'
                    : '#6dbe30',
              }}
            >
              {displayScore}
            </span>
            <span className="text-2xl sm:text-3xl font-mono text-neutral-400 font-light">
              / 100
            </span>
          </div>

          <div className="pt-2">
            <span
              className="inline-block px-3 py-1 rounded-full font-mono text-xs font-bold uppercase tracking-wider border shadow-md"
              style={{
                backgroundColor:
                  score > 65
                    ? 'rgba(239, 68, 68, 0.15)'
                    : score > 35
                    ? 'rgba(245, 158, 11, 0.15)'
                    : score > 0
                    ? 'rgba(52, 211, 153, 0.15)'
                    : 'rgba(109, 190, 48, 0.15)',
                color:
                  score > 65
                    ? '#f87171'
                    : score > 35
                    ? '#fbbf24'
                    : score > 0
                    ? '#34d399'
                    : '#6dbe30',
                borderColor:
                  score > 65
                    ? 'rgba(239, 68, 68, 0.3)'
                    : score > 35
                    ? 'rgba(245, 158, 11, 0.3)'
                    : score > 0
                    ? 'rgba(52, 211, 153, 0.3)'
                    : 'rgba(109, 190, 48, 0.3)',
              }}
            >
              EXPOSURE BAND: {band}
            </span>
          </div>
        </div>

        <p className="text-xs sm:text-sm font-sans text-neutral-300 max-w-xl mx-auto leading-relaxed border-t border-white/10 pt-4">
          &quot;Once sent, this is unrecoverable. The provider&apos;s retention policy, not yours, now governs this data.&quot;
        </p>
      </div>

      {/* SECTION 2: ANNOTATED PROMPT */}
      <div data-material="panel"
        className="rounded-2xl border border-red-500/30 bg-black/50 backdrop-blur-xl p-5 sm:p-6 space-y-3 relative shadow-xl">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-red-400 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
            Annotated Exposure Breakdown
          </h3>
          <span className="text-xs font-mono text-neutral-400">
            Hover highlights for details
          </span>
        </div>

        {/* Hover Popover Tooltip */}
        {hoveredFinding && (
          <div className="p-3 rounded-lg bg-neutral-900 border border-white/20 text-xs font-mono text-white space-y-1 shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-amber-400">{hoveredFinding.label}</span>
              <span className="text-[10px] text-neutral-400 uppercase">
                {hoveredFinding.tier === 0 ? 'Tier 0 Checksum' : 'Tier 1 Heuristic'}
              </span>
            </div>
            <div className="text-[11px] text-neutral-300">
              Type: <span className="text-white">{hoveredFinding.type}</span> | Confidence:{' '}
              <span className="text-[#6DBE30]">{Math.round(hoveredFinding.confidence * 100)}%</span>
            </div>
            <div className="text-[10px] text-neutral-400">
              Implicated Regulations: {hoveredFinding.regulations.join(', ')}
            </div>
          </div>
        )}

        <div className="p-4 rounded-xl bg-neutral-950 border border-white/10 text-xs leading-relaxed whitespace-pre-wrap font-mono">
          {renderAnnotatedPrompt()}
        </div>
      </div>

      {/* SECTION 3: FINDINGS LEDGER TABLE */}
      <div data-material="panel"
        className="rounded-2xl border border-white/10 bg-black/50 backdrop-blur-xl p-5 sm:p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-white">
            Findings Ledger
          </h3>
          <span className="text-xs font-mono text-neutral-400">
            {activeFindings.length} active findings
          </span>
        </div>

        {Object.keys(groupedFindings).length === 0 ? (
          <div className="p-4 rounded-xl bg-[#6DBE30]/10 border border-[#6DBE30]/20 text-[#6DBE30] font-mono text-xs text-center">
            ✓ No active findings present in this ledger.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-neutral-400 text-[11px] uppercase tracking-wider">
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Count</th>
                  <th className="py-2.5 px-3">Redacted Preview</th>
                  <th className="py-2.5 px-3">Confidence</th>
                  <th className="py-2.5 px-3">Tier</th>
                  <th className="py-2.5 px-3">Handling</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {Object.entries(groupedFindings).map(([category, items]) => (
                  <React.Fragment key={category}>
                    <tr className="bg-white/[0.02]">
                      <td
                        colSpan={7}
                        className="py-1.5 px-3 text-[10px] uppercase font-bold tracking-widest text-neutral-400"
                      >
                        // {category}
                      </td>
                    </tr>
                    {items.map((item) => (
                      <tr key={item.id} className="hover:bg-white/[0.03] transition-colors">
                        <td className="py-2.5 px-3 font-semibold text-white">
                          {item.label}
                          <span className="block text-[10px] text-neutral-400 font-normal">
                            {item.type}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-neutral-300">1</td>
                        <td className="py-2.5 px-3">
                          <code className="px-2 py-0.5 rounded bg-white/10 text-[#6DBE30] font-mono text-[11px]">
                            {getRedactedPreview(item.matched)}
                          </code>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <div className="w-12 h-1.5 rounded-full bg-white/10 overflow-hidden">
                              <div
                                className="h-full bg-[#6DBE30]"
                                style={{ width: `${item.confidence * 100}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-neutral-400">
                              {Math.round(item.confidence * 100)}%
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          {item.tier === 0 ? (
                            <span className="px-2 py-0.5 rounded bg-[#6DBE30]/20 border border-[#6DBE30]/30 text-[#6DBE30] text-[10px] font-bold">
                              TIER 0 PATTERN
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[10px] font-bold">
                              TIER 1 HEURISTIC
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="text-[10px] font-bold text-red-400">
                            {item.handling}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {item.tier === 1 && (
                            <button
                              onClick={() => onDismissFinding(item.id)}
                              className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-[10px] font-mono transition-[background-color,transform] duration-150 ease-out active:scale-[0.97] cursor-pointer"
                            >
                              Dismiss
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SECTION 4: REGULATORY EXPOSURE */}
      <div data-material="panel"
        className="rounded-2xl border border-white/10 bg-black/50 backdrop-blur-xl p-5 sm:p-6 space-y-4 shadow-xl">
        <div className="border-b border-white/10 pb-3">
          <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-white">
            Regulatory Compliance Impact
          </h3>
          <p className="text-xs text-neutral-400 font-sans mt-0.5">
            Compliance frameworks implicated by prompt contents
          </p>
        </div>

        {implicatedRegs.length === 0 ? (
          <p className="text-xs font-mono text-[#6DBE30] p-3 bg-[#6DBE30]/10 rounded-xl border border-[#6DBE30]/20">
            ✓ Zero regulatory compliance violations detected.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-xs">
            {implicatedRegs.map((reg) => (
              <div
                key={reg.name}
                className="p-3 rounded-xl border border-white/10 bg-white/[0.02] space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-300">{reg.name}</span>
                  <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-200 text-[10px] font-bold">
                    {reg.count} {reg.count === 1 ? 'finding' : 'findings'}
                  </span>
                </div>
                <div className="text-[11px] text-neutral-300">
                  {reg.count} {reg.count === 1 ? 'finding implicates' : 'findings implicate'}{' '}
                  <span className="text-white font-semibold">{reg.name}</span> {reg.section}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SECTION 5: THE FLIP (BEFORE vs AFTER TORKQ) */}
      <div data-material="panel"
        className="rounded-2xl border border-white/10 bg-black/50 backdrop-blur-xl p-5 sm:p-6 space-y-4 shadow-xl">
        <div className="border-b border-white/10 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <div>
            <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-white">
              The Flip — Before & After TorkQ
            </h3>
            <p className="text-xs font-sans text-neutral-400">
              Visual comparison of raw prompt vs sanitised payload
            </p>
          </div>
          <span className="text-xs font-mono text-[#6DBE30] font-bold px-2 py-1 rounded-lg bg-[#6DBE30]/10 border border-[#6DBE30]/20 self-start sm:self-auto">
            &quot;The model never saw it.&quot;
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
          {/* RAW PROMPT (EXPOSED) */}
          <div className="space-y-2">
            <div className="text-[11px] uppercase font-bold text-red-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              Raw Prompt (Exposed to Model)
            </div>
            <pre className="p-3 rounded-xl bg-red-950/20 border border-red-500/30 text-red-200 whitespace-pre-wrap leading-relaxed text-[11px] min-h-[120px]">
              {promptText}
            </pre>
          </div>

          {/* SANITISED PROMPT (TORKQ REHYDRATED) */}
          <div className="space-y-2">
            <div className="text-[11px] uppercase font-bold text-[#6DBE30] flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#6DBE30]" />
              TorkQ Sanitised Token Stream
            </div>
            <pre className="p-3 rounded-xl bg-[#6DBE30]/10 border border-[#6DBE30]/30 text-[#8BE14A] whitespace-pre-wrap leading-relaxed text-[11px] min-h-[120px]">
              {maskedPrompt(promptText, findings)}
            </pre>
          </div>
        </div>

        {/* EVIDENCE CHAIN RECEIPT */}
        <div className="pt-3 border-t border-white/10 font-mono text-[10px] text-neutral-400 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div>
            SHA-256: <span className="text-neutral-200 font-semibold">{receiptHash}</span> | Timestamp:{' '}
            <span className="text-neutral-200">{new Date().toISOString().slice(0, 19).replace('T', ' ')} UTC</span>
          </div>
          <div className="text-[#6DBE30] font-bold">
            ✓ Chained to previous entry #10428
          </div>
        </div>
      </div>

      {/* SECTION 6: CTA & REMEDIATION CONTROL */}
      <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
        <a
          href="#contact"
          className="w-full sm:w-auto px-6 py-3.5 rounded-full bg-[#6DBE30] text-black font-mono text-xs font-bold uppercase tracking-wider hover:brightness-110 transition-[filter,box-shadow,transform] duration-150 ease-out active:scale-[0.98] text-center shadow-lg hover:shadow-[#6DBE30]/20"
        >
          Run this on your own infrastructure →
        </a>

        <button
          onClick={onRemediate}
          className="w-full sm:w-auto px-5 py-3.5 rounded-full bg-white/10 hover:bg-white/15 border border-white/20 text-white font-mono text-xs font-bold uppercase tracking-wider transition-[background-color,transform] duration-150 ease-out active:scale-[0.98] text-center cursor-pointer"
        >
          Show me what TorkQ would have sent
        </button>
      </div>

      {/* BOTTOM ANCHOR FOR SCROLL OBSERVER */}
      <div ref={bottomRef} className="h-4 w-full" aria-hidden="true" />
    </div>
  );
};
