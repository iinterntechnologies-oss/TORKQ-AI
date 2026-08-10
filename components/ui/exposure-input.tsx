import React, { useState, useRef, useEffect } from 'react';
import { useReducedMotion } from 'framer-motion';
import { useThemeState } from '../../lib/theme-state';
import { FlowDiagramHandle } from './flow-diagram';
import { ScanSequence } from './scan-sequence';
import { ExposureReport } from './exposure-report';
import {
  detectFindings,
  exposureScore,
  Finding,
} from '../../lib/sentinel';

const SAMPLE_PROMPTS = [
  {
    label: 'Debug this customer record',
    text: `Customer Support Escalation:
Name: Employee: Rajesh Sharma
Aadhaar: 2345 6789 0124
Email: rajesh.sharma@acme-corp.in
Mobile: +91 9876543210
Issue: Customer unable to verify Aadhaar linked account.`,
  },
  {
    label: 'Draft an offer letter',
    text: `Employment Offer - Confidentially Prepared
Dear Candidate John Doe,
We are pleased to offer you the role of Senior Architect at Tech Solutions LLC.
Annual Compensation / CTC: $145,000 per annum + performance bonus.
Please send your signed agreement and Emirates ID (784-1990-1234569-5) to hr@techsolutions.ae.`,
  },
  {
    label: 'Summarize this bank statement',
    text: `Account Statement - Gulf Regional Branch
Account Holder: Saudi Iqama 2345678903
IBAN: GB82WEST12345698765432
Branch IFSC: HDFC0001234
Primary Credit Card: 4111 1111 1111 1111
Closing Balance: AED 84,500.00`,
  },
  {
    label: 'Fix my deployment script',
    text: `# Deployment Config - DO NOT SHARE PUBLICLY
OPENAI_API_KEY="sk-proj-9876543210abcdef9876543210abcdef98"
GITHUB_TOKEN="ghp_1234567890abcdef1234567890abcdef1234"
AWS_ACCESS_KEY="AKIAIOSFODNN7EXAMPLE"
SERVER_IP="192.168.1.100"
Database URL: https://admin:secretPass123@db.internal.net`,
  },
];

interface ExposureInputProps {
  flowDiagramRef?: React.RefObject<FlowDiagramHandle | null>;
}

export const ExposureInput: React.FC<ExposureInputProps> = ({ flowDiagramRef }) => {
  const { accent, setExposureScore, setState } = useThemeState();
  const prefersReducedMotion = useReducedMotion();
  const [promptText, setPromptText] = useState('');
  const [findings, setFindings] = useState<Finding[]>([]);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanId, setScanId] = useState(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chatboxRef = useRef<HTMLDivElement>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  // Auto-resize textarea logic (min 3rem, max 9.375rem).
  // Bounds are derived from the root font size rather than hard-coded px, so a
  // user running larger text still gets the same number of visible lines.
  useEffect(() => {
    if (textareaRef.current) {
      const rootPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      const newHeight = Math.min(Math.max(scrollHeight, 3 * rootPx), 9.375 * rootPx);
      textareaRef.current.style.height = `${newHeight}px`;
    }
  }, [promptText]);

  const handleAnalyze = (textToAnalyze?: string) => {
    const text = textToAnalyze !== undefined ? textToAnalyze : promptText;
    if (!text || !text.trim()) return;

    // Reset flow diagram cleanly on new submission
    if (flowDiagramRef?.current) {
      flowDiagramRef.current.resetFlow();
    }

    const detected = detectFindings(text);
    setFindings(detected);
    setHasAnalyzed(true);

    // Trigger Scan Sequence Choreography with fresh key
    setScanId((prev) => prev + 1);
    setIsScanning(true);
  };

  const handleSequenceComplete = () => {
    setIsScanning(false);
    const score = exposureScore(findings);
    setExposureScore(score);

    if (findings.length > 0 && score > 0) {
      setState('exposed');
    } else {
      setState('safe');
    }

    // Smooth scroll DOWN to the report section
    setTimeout(() => {
      if (reportRef.current) {
        reportRef.current.scrollIntoView({
          behavior: prefersReducedMotion ? 'auto' : 'smooth',
          block: 'start',
        });
      }
    }, 50);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAnalyze();
    }
  };

  const handleSelectSample = (sampleText: string) => {
    setPromptText(sampleText);
    handleAnalyze(sampleText);
  };

  const handleDismissFinding = (id: string) => {
    const updated = findings.map((f) =>
      f.id === id ? { ...f, dismissed: true } : f
    );
    setFindings(updated);

    const score = exposureScore(updated);
    setExposureScore(score);

    if (score === 0 || updated.every((f) => f.dismissed)) {
      setState('safe');
    } else {
      setState('exposed');
    }
  };

  const handleRemediate = () => {
    setState('remediated');
    if (flowDiagramRef?.current) {
      flowDiagramRef.current.resumeAmbient();
    }
  };

  const activeScore = exposureScore(findings);

  return (
    <div className="w-full max-w-[900px] mx-auto space-y-8 relative">
      {/* SCAN SEQUENCE ANIMATION OVERLAY */}
      {flowDiagramRef && (
        <ScanSequence
          key={scanId}
          isActive={isScanning}
          promptText={promptText}
          findings={findings}
          flowDiagramRef={flowDiagramRef}
          chatboxRef={chatboxRef}
          onSequenceComplete={handleSequenceComplete}
        />
      )}

      {/* SECTION HEADER */}
      <div className="text-center space-y-2">
        <h2 className="text-xl sm:text-2xl font-sans font-bold text-white tracking-heading leading-heading">
          Check how much data you&apos;re exposing to AI
        </h2>
        <p className="text-xs sm:text-sm font-sans text-neutral-400">
          Type or paste a prompt. Nothing leaves your browser.
        </p>
      </div>

      {/* CHATBOX CONTAINER WITH GLASS STYLE */}
      <div
        ref={chatboxRef}
        data-material="panel"
        className={`rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-4 sm:p-5 shadow-2xl relative space-y-4 transition-[opacity,box-shadow] duration-300 z-20 ${
          isScanning ? 'opacity-60 pointer-events-none ring-2 ring-amber-500/50' : ''
        }`}
      >
        {/* TEXTAREA FORM */}
        <div className="space-y-2">
          <label htmlFor="exposure-prompt-input" className="sr-only">
            AI Prompt Content Scanner
          </label>
          <textarea
            id="exposure-prompt-input"
            ref={textareaRef}
            value={promptText}
            disabled={isScanning}
            onChange={(e) => setPromptText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Paste raw prompt, code snippet, or customer data here..."
            className="w-full bg-transparent text-white placeholder-neutral-400 font-sans text-sm focus:outline-none resize-none overflow-y-auto min-h-[3rem] max-h-[9.375rem] leading-body disabled:text-neutral-400"
            rows={2}
          />
        </div>

        {/* BOTTOM TOOLBAR */}
        <div className="pt-3 border-t border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          {/* LIVE PRIVACY INDICATOR */}
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#6DBE30] opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#6DBE30]" />
            </span>
            <div className="font-mono text-[11px] leading-tight">
              <span className="text-neutral-200 font-semibold block">
                0 bytes sent — computed on your device
              </span>
              <span className="text-neutral-400 text-[10px] block">
                Open DevTools &gt; Network tab to verify 0 requests
              </span>
            </div>
          </div>

          {/* SEND / ANALYZE BUTTON */}
          <button
            onClick={() => handleAnalyze()}
            disabled={!promptText.trim() || isScanning}
            className={`w-full sm:w-auto px-6 py-2.5 rounded-full font-mono text-xs font-bold uppercase tracking-wider transition-[filter,transform,background-color] duration-150 ease-out active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer ${
              promptText.trim() && !isScanning
                ? 'text-black shadow-lg hover:brightness-110'
                : 'bg-white/5 text-neutral-600 cursor-not-allowed border border-white/5'
            }`}
            style={{
              backgroundColor: promptText.trim() && !isScanning ? accent : undefined,
            }}
          >
            <span>{isScanning ? 'Scanning...' : 'Scan Prompt'}</span>
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M14 5l7 7m0 0l-7 7m7-7H3"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* SAMPLE PROMPT CHIPS */}
      <div className="space-y-2">
        <div className="text-[11px] font-mono uppercase tracking-wider text-neutral-400">
          // Try sample prompts:
        </div>
        <div className="flex flex-wrap gap-2">
          {SAMPLE_PROMPTS.map((sample) => (
            <button
              key={sample.label}
              onClick={() => handleSelectSample(sample.text)}
              disabled={isScanning}
              className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-neutral-300 font-mono text-xs hover:border-white/25 hover:bg-white/10 hover:text-white transition-[background-color,border-color,color,transform] duration-150 ease-out active:scale-[0.97] text-left cursor-pointer disabled:opacity-50"
            >
              &quot;{sample.label}&quot;
            </button>
          ))}
        </div>
      </div>

      {/* EXPOSURE REPORT MOUNT POINT */}
      <div ref={reportRef} className="pt-4">
        {hasAnalyzed && !isScanning && (
          <ExposureReport
            promptText={promptText}
            findings={findings}
            score={activeScore}
            onDismissFinding={handleDismissFinding}
            onRemediate={handleRemediate}
          />
        )}
      </div>
    </div>
  );
};
