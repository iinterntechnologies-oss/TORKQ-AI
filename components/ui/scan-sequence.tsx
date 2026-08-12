import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useThemeState } from '../../lib/theme-state';
import { FlowDiagramHandle, NodeId } from './flow-diagram';
import { Finding, maskedPrompt, exposureScore } from '../../lib/sentinel';

export type BeatName =
  | 'IDLE'
  | 'SEIZE'                 // BEAT 1: 0 - 600ms
  | 'PAUSE_1'               // PAUSE: 600 - 900ms
  | 'LIFT_SCROLL'           // BEAT 2: 900 - 1800ms
  | 'PAUSE_2'               // PAUSE: 1800 - 2200ms
  | 'TRAVEL_WORKSTATION'    // BEAT 3: 2200 - 3100ms
  | 'HOLD_WORKSTATION'      // HOLD: 3100 - 3800ms
  | 'TRAVEL_TORKQ'          // BEAT 4: 3800 - 4700ms
  | 'HOLD_TORKQ'            // HOLD: 4700 - 5100ms
  | 'SCAN_TORKQ'            // BEAT 5: 5100 - 7300ms
  | 'PAUSE_SCAN'            // PAUSE: 7300 - 7800ms
  | 'TRANSFORM_TORKQ'       // BEAT 6: 7800 - 8700ms
  | 'PAUSE_TRANSFORM'       // PAUSE: 8700 - 9200ms
  | 'TRAVEL_AI'             // BEAT 7: 9200 - 9900ms
  | 'PAUSE_AI'              // PAUSE: 9900 - 10300ms
  | 'VERDICT'               // BEAT 8: 10300 - 11100ms
  | 'COMPLETE';

interface ScanSequenceProps {
  isActive: boolean;
  promptText: string;
  findings: Finding[];
  flowDiagramRef: React.RefObject<FlowDiagramHandle | null>;
  chatboxRef: React.RefObject<HTMLDivElement | null>;
  onSequenceComplete: () => void;
}

interface NodeAnchor {
  centerX: number;
  centerY: number;
  cardEdgeY: number;
  nodeEdgeY: number;
  isAbove: boolean;
  nodeBounds?: {
    x: number;
    y: number;
    top?: number;
    bottom?: number;
    left?: number;
    right?: number;
    width?: number;
    height?: number;
  };
}

/**
 * Spring easing for physical arrival overshoot.
 * Damping ratio ≈ 0.78, response ≈ 0.44s — a momentum-carrying arrival.
 *
 * `durationMs` is the real length of the beat, so the spring advances in real
 * time and every leg shares one set of physics. Compressing a fixed span of
 * spring-time into each beat instead would make the short legs feel like a
 * lighter object.
 */
function arrivalSpring(t: number, durationMs: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  if (clamped === 1) return 1;
  const timeSec = clamped * (durationMs / 1000);
  return 1 - Math.exp(-11 * timeSec) * (Math.cos(8.888 * timeSec) + 1.238 * Math.sin(8.888 * timeSec));
}

/**
 * Cubic ease out curve
 */
function cubicEase(t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  return 1 - Math.pow(1 - clamped, 3);
}

export const ScanSequence: React.FC<ScanSequenceProps> = ({
  isActive,
  promptText,
  findings,
  flowDiagramRef,
  chatboxRef,
  onSequenceComplete,
}) => {
  const { setState, setExposureScore, reducedMotion } = useThemeState();

  const [beat, setBeat] = useState<BeatName>('IDLE');
  const [cardPos, setCardPos] = useState<{ x: number; y: number; scale: number }>({
    x: 0,
    y: 0,
    scale: 1,
  });
  const [cardOpacity, setCardOpacity] = useState(1.0);

  // Glow double-intensity multiplier for arrival moments
  const [glowMultiplier, setGlowMultiplier] = useState(1.0);
  // Scale pulse modifier on arrival
  const [scalePulse, setScalePulse] = useState(1.0);

  // Connector line coordinates
  const [connectorLine, setConnectorLine] = useState<{
    x: number;
    y1: number;
    y2: number;
    visible: boolean;
  }>({ x: 0, y1: 0, y2: 0, visible: false });

  const [scanlineProgress, setScanlineProgress] = useState(0);
  const [announceTier0, setAnnounceTier0] = useState(false);
  const [announceTier1, setAnnounceTier1] = useState(false);
  const [runningFoundCount, setRunningFoundCount] = useState(0);
  const [cardTransformed, setCardTransformed] = useState(false);
  const [borderProgress, setBorderProgress] = useState(0);
  const [absorbedAtAi, setAbsorbedAtAi] = useState(false);

  const cardRef = useRef<HTMLDivElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const hasCompletedRef = useRef<boolean>(false);
  // Lets Escape (and the visible skip control) jump straight to the end state.
  // A ten-second transition the user cannot leave is not a transition, it's a wall.
  const finishRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!isActive) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finishRef.current?.();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isActive]);

  const cardTextSnippet = promptText.length > 80 ? promptText.slice(0, 80) + '...' : promptText;

  /**
   * The payload card is a viewport overlay, so it can only sit centred on a
   * node that is at least half a card in from the edge. On a wide diagram the
   * outer nodes are not — the AI node is about 100px from the right at 1440 —
   * so rather than let the card hang off the screen, slide it back inside.
   * The clamp relaxes as the card shrinks into the node at the end of the run,
   * so it still lands centred on it.
   */
  const clampCardX = (x: number, cardWidth: number): number => {
    const margin = 8;
    const half = cardWidth / 2;
    if (cardWidth + margin * 2 >= window.innerWidth) return x;
    return Math.min(Math.max(x, half + margin), window.innerWidth - half - margin);
  };

  // Helper to compute exact anchor position above (or below) a node
  const computeNodeAnchor = (id: NodeId): NodeAnchor => {
    const cardEl = cardRef.current;
    const cardRect = cardEl ? cardEl.getBoundingClientRect() : null;
    const cardHeight = cardRect ? cardRect.height : 115;
    const cardWidth = cardRect ? cardRect.width : 420;

    const bounds = flowDiagramRef.current?.getNodePosition(id);
    if (!bounds || (bounds.x === 0 && bounds.y === 0)) {
      const fallbackY = window.innerHeight * 0.32;
      return {
        centerX: window.innerWidth * 0.5,
        centerY: fallbackY - 110,
        cardEdgeY: fallbackY - 55,
        nodeEdgeY: fallbackY - 30,
        isAbove: true,
      };
    }

    const nodeTop = bounds.top !== undefined && bounds.top > 0 ? bounds.top : bounds.y - 45;
    const nodeBottom = bounds.bottom !== undefined && bounds.bottom > 0 ? bounds.bottom : bounds.y + 45;
    const gap = 24; // ~24px gap requested by user

    // Check if placing above node has enough clearance from top of viewport (~70px for fixed nav)
    const isAbove = nodeTop - gap - cardHeight >= 70;

    if (isAbove) {
      const cardBottomY = nodeTop - gap;
      const centerY = cardBottomY - cardHeight / 2;
      return {
        centerX: clampCardX(bounds.x, cardWidth),
        centerY,
        cardEdgeY: cardBottomY,
        nodeEdgeY: nodeTop,
        isAbove: true,
      };
    } else {
      const cardTopY = nodeBottom + gap;
      const centerY = cardTopY + cardHeight / 2;
      return {
        centerX: clampCardX(bounds.x, cardWidth),
        centerY,
        cardEdgeY: cardTopY,
        nodeEdgeY: nodeBottom,
        isAbove: false,
      };
    }
  };

  useEffect(() => {
    if (!isActive) {
      setBeat('IDLE');
      hasCompletedRef.current = false;
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
      }
      return;
    }

    if (hasCompletedRef.current) return;

    // REDUCED MOTION INSTANT SKIP
    if (reducedMotion) {
      hasCompletedRef.current = true;
      flowDiagramRef.current?.freezeAmbient();
      const score = exposureScore(findings);
      setExposureScore(score);
      if (findings.length > 0 && score > 0) {
        setState('exposed');
      } else {
        setState('safe');
      }
      setBeat('COMPLETE');
      onSequenceComplete();
      return;
    }

    // INITIALIZE CHOREOGRAPHY
    startTimeRef.current = performance.now();
    setCardTransformed(false);
    flowDiagramRef.current?.setTorkqTransformed?.(false);
    setBorderProgress(0);
    setAbsorbedAtAi(false);
    setAnnounceTier0(false);
    setAnnounceTier1(false);
    setRunningFoundCount(0);
    setScanlineProgress(0);
    setCardOpacity(1.0);
    setGlowMultiplier(1.0);
    setScalePulse(1.0);

    const targetScore = exposureScore(findings);

    // Get Chatbox starting position
    const getChatboxPos = () => {
      if (chatboxRef.current) {
        const rect = chatboxRef.current.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      }
      return { x: window.innerWidth / 2, y: window.innerHeight - 150 };
    };

    let hasScrolled = false;
    let wsTargeted = false;
    let wsActive = false;
    let wsBloomed = false;
    let tqTargeted = false;
    let tqActive = false;
    let tqBloomed = false;
    let aiTargeted = false;

    // Single exit path, shared by the natural end of the choreography and by
    // the user skipping it.
    const finish = () => {
      if (hasCompletedRef.current) return;
      hasCompletedRef.current = true;

      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }

      setBeat('COMPLETE');
      setAbsorbedAtAi(true);
      setCardOpacity(0);
      setConnectorLine({ x: 0, y1: 0, y2: 0, visible: false });

      // Zoom releases, visited trail resets to dormant, ambient packet loop restarts
      flowDiagramRef.current?.resetFlow?.();

      // Score & state so the particle field reacts as the report arrives
      setExposureScore(targetScore);
      if (findings.length > 0 && targetScore > 0) {
        setState('exposed');
      } else {
        setState('safe');
      }

      onSequenceComplete();
    };

    finishRef.current = finish;

    const animateSequence = (now: number) => {
      const elapsed = now - startTimeRef.current;
      const cbPos = getChatboxPos();

      // Realtime anchor calculation for all 3 nodes
      const wsAnchor = computeNodeAnchor('workstation');
      const tqAnchor = computeNodeAnchor('torkq');
      const aiAnchor = computeNodeAnchor('ai');

      // ==========================================
      // BEAT 1: SEIZE (0ms - 600ms)
      // ==========================================
      if (elapsed < 600) {
        if (beat !== 'SEIZE') {
          setBeat('SEIZE');
          flowDiagramRef.current?.freezeAmbient();
          flowDiagramRef.current?.setZoom(true);
          flowDiagramRef.current?.setAllNodeStates({
            prompt: 'DORMANT',
            workstation: 'DORMANT',
            torkq: 'DORMANT',
            ai: 'DORMANT',
          });
          setState('scanning');
        }
        // Emerge from the chatbox rather than appearing at full size — the
        // mirror of the shrink-into-the-AI-node exit at the end of the sequence.
        const intro = cubicEase(elapsed / 250);
        setCardPos({ x: cbPos.x, y: cbPos.y, scale: 0.92 + 0.08 * intro });
        setCardOpacity(intro);
        setConnectorLine({ x: 0, y1: 0, y2: 0, visible: false });
      }
      // ==========================================
      // PAUSE 1: (600ms - 900ms)
      // ==========================================
      else if (elapsed < 900) {
        if (beat !== 'PAUSE_1') setBeat('PAUSE_1');
        setCardPos({ x: cbPos.x, y: cbPos.y, scale: 1.0 });
        setCardOpacity(1.0);
        setConnectorLine({ x: 0, y1: 0, y2: 0, visible: false });
      }
      // ==========================================
      // BEAT 2: LIFT + AUTO-SCROLL (900ms - 1800ms)
      // ==========================================
      else if (elapsed < 1800) {
        if (beat !== 'LIFT_SCROLL') setBeat('LIFT_SCROLL');

        if (!hasScrolled) {
          hasScrolled = true;
          const flowEl = document.getElementById('flow');
          if (flowEl) {
            const rect = flowEl.getBoundingClientRect();
            const targetY = window.scrollY + rect.top - (window.innerHeight - rect.height) / 2;
            window.scrollTo({
              top: Math.max(0, targetY),
              behavior: reducedMotion ? 'auto' : 'smooth',
            });
          }
        }

        const progress = cubicEase((elapsed - 900) / 900);
        const y = cbPos.y - progress * 50;

        setCardPos({ x: cbPos.x, y, scale: 1.0 });
        setCardOpacity(1.0);
        setConnectorLine({ x: 0, y1: 0, y2: 0, visible: false });

        if (elapsed >= 1600 && !wsTargeted) {
          wsTargeted = true;
          flowDiagramRef.current?.setNodeState('workstation', 'TARGETED');
        }
      }
      // ==========================================
      // PAUSE 2: (1800ms - 2200ms)
      // ==========================================
      else if (elapsed < 2200) {
        if (beat !== 'PAUSE_2') setBeat('PAUSE_2');
        setCardPos({ x: cbPos.x, y: cbPos.y - 50, scale: 1.0 });
        setCardOpacity(1.0);
        setConnectorLine({ x: 0, y1: 0, y2: 0, visible: false });
      }
      // ==========================================
      // BEAT 3: → WORKSTATION ANCHOR (2200ms - 3100ms)
      // ==========================================
      else if (elapsed < 3100) {
        if (beat !== 'TRAVEL_WORKSTATION') setBeat('TRAVEL_WORKSTATION');

        if (!wsActive && elapsed >= 2400) {
          wsActive = true;
          flowDiagramRef.current?.setNodeState('workstation', 'ACTIVE');
        }

        const p0 = { x: cbPos.x, y: cbPos.y - 50 };
        const p1 = { x: wsAnchor.centerX, y: wsAnchor.centerY };
        const pCtrl = { x: (p0.x + p1.x) / 2, y: Math.min(p0.y, p1.y) - 60 };

        const t = arrivalSpring((elapsed - 2200) / 900, 900);
        const x = (1 - t) * (1 - t) * p0.x + 2 * (1 - t) * t * pCtrl.x + t * t * p1.x;
        const y = (1 - t) * (1 - t) * p0.y + 2 * (1 - t) * t * pCtrl.y + t * t * p1.y;

        setCardPos({ x, y, scale: 1.0 });
        setCardOpacity(1.0);

        // Show connector line as card nears workstation
        if (elapsed >= 2800) {
          setConnectorLine({
            x: wsAnchor.centerX,
            y1: wsAnchor.cardEdgeY,
            y2: wsAnchor.nodeEdgeY,
            visible: true,
          });
        } else {
          setConnectorLine({ x: 0, y1: 0, y2: 0, visible: false });
        }
      }
      // ==========================================
      // HOLD AT WORKSTATION: ARRIVAL GLOW-UP (3100ms - 3800ms)
      // ==========================================
      else if (elapsed < 3800) {
        if (beat !== 'HOLD_WORKSTATION') setBeat('HOLD_WORKSTATION');

        // Simultaneous Card + Node Glow-Up on Arrival
        if (!wsBloomed) {
          wsBloomed = true;
          flowDiagramRef.current?.setNodeState('prompt', 'VISITED');
          flowDiagramRef.current?.setLegState('A', true);
          flowDiagramRef.current?.setNodeState('workstation', 'ACTIVE');
        }

        const holdT = elapsed - 3100;
        // Card scale pulse: 1.0 -> 1.06 -> 1.0 for 400ms
        const pulse = holdT < 400 ? 1.0 + 0.06 * Math.sin((holdT / 400) * Math.PI) : 1.0;
        // Card glow intensity doubles for 300ms
        const glow = holdT < 300 ? 2.0 : 1.0;

        setScalePulse(pulse);
        setGlowMultiplier(glow);

        setCardPos({ x: wsAnchor.centerX, y: wsAnchor.centerY, scale: 1.0 });
        setCardOpacity(1.0);
        setConnectorLine({
          x: wsAnchor.centerX,
          y1: wsAnchor.cardEdgeY,
          y2: wsAnchor.nodeEdgeY,
          visible: true,
        });

        if (elapsed >= 3600 && !tqTargeted) {
          tqTargeted = true;
          flowDiagramRef.current?.setNodeState('workstation', 'VISITED');
          flowDiagramRef.current?.setLegState('B', true);
          flowDiagramRef.current?.setNodeState('torkq', 'TARGETED');
        }
      }
      // ==========================================
      // BEAT 4: → TORKQ ANCHOR (3800ms - 4700ms)
      // ==========================================
      else if (elapsed < 4700) {
        if (beat !== 'TRAVEL_TORKQ') setBeat('TRAVEL_TORKQ');

        if (!tqActive && elapsed >= 4000) {
          tqActive = true;
          flowDiagramRef.current?.setNodeState('torkq', 'ACTIVE');
        }

        const p0 = { x: wsAnchor.centerX, y: wsAnchor.centerY };
        const p1 = { x: tqAnchor.centerX, y: tqAnchor.centerY };
        const pCtrl = { x: (p0.x + p1.x) / 2, y: Math.min(p0.y, p1.y) - 40 };

        const t = arrivalSpring((elapsed - 3800) / 900, 900);
        const x = (1 - t) * (1 - t) * p0.x + 2 * (1 - t) * t * pCtrl.x + t * t * p1.x;
        const y = (1 - t) * (1 - t) * p0.y + 2 * (1 - t) * t * pCtrl.y + t * t * p1.y;

        setCardPos({ x, y, scale: 1.0 });
        setCardOpacity(1.0);

        if (elapsed >= 4400) {
          setConnectorLine({
            x: tqAnchor.centerX,
            y1: tqAnchor.cardEdgeY,
            y2: tqAnchor.nodeEdgeY,
            visible: true,
          });
        } else {
          setConnectorLine({ x: 0, y1: 0, y2: 0, visible: false });
        }
      }
      // ==========================================
      // HOLD AT TORKQ: ARRIVAL GLOW-UP (4700ms - 5100ms)
      // ==========================================
      else if (elapsed < 5100) {
        if (beat !== 'HOLD_TORKQ') setBeat('HOLD_TORKQ');

        if (!tqBloomed) {
          tqBloomed = true;
          flowDiagramRef.current?.setNodeState('torkq', 'ACTIVE');
        }

        const holdT = elapsed - 4700;
        const pulse = holdT < 400 ? 1.0 + 0.06 * Math.sin((holdT / 400) * Math.PI) : 1.0;
        const glow = holdT < 300 ? 2.0 : 1.0;

        setScalePulse(pulse);
        setGlowMultiplier(glow);

        setCardPos({ x: tqAnchor.centerX, y: tqAnchor.centerY, scale: 1.0 });
        setCardOpacity(1.0);
        setConnectorLine({
          x: tqAnchor.centerX,
          y1: tqAnchor.cardEdgeY,
          y2: tqAnchor.nodeEdgeY,
          visible: true,
        });
      }
      // ==========================================
      // BEAT 5: SCAN AT TORKQ NODE (5100ms - 7300ms, 2200ms)
      // ==========================================
      else if (elapsed < 7300) {
        if (beat !== 'SCAN_TORKQ') {
          setBeat('SCAN_TORKQ');
          flowDiagramRef.current?.setTorkqRhythmic(true);
        }

        setScalePulse(1.0);
        setGlowMultiplier(1.0);

        setCardPos({ x: tqAnchor.centerX, y: tqAnchor.centerY, scale: 1.0 });
        setCardOpacity(1.0);
        setConnectorLine({
          x: tqAnchor.centerX,
          y1: tqAnchor.cardEdgeY,
          y2: tqAnchor.nodeEdgeY,
          visible: true,
        });

        // Scanline passes top to bottom over 1.4s
        const scanT = Math.min(1.0, (elapsed - 5100) / 1400);
        setScanlineProgress(scanT);

        if (elapsed >= 5700 && !announceTier0) setAnnounceTier0(true);
        if (elapsed >= 6300 && !announceTier1) setAnnounceTier1(true);

        const count = Math.min(
          findings.length,
          Math.floor((elapsed - 5100) / 350)
        );
        setRunningFoundCount(Math.max(0, count));
      }
      // ==========================================
      // PAUSE SCAN: (7300ms - 7800ms)
      // ==========================================
      else if (elapsed < 7800) {
        if (beat !== 'PAUSE_SCAN') setBeat('PAUSE_SCAN');
        setCardPos({ x: tqAnchor.centerX, y: tqAnchor.centerY, scale: 1.0 });
        setCardOpacity(1.0);
        setRunningFoundCount(findings.length);
        setConnectorLine({
          x: tqAnchor.centerX,
          y1: tqAnchor.cardEdgeY,
          y2: tqAnchor.nodeEdgeY,
          visible: true,
        });
      }
      // ==========================================
      // BEAT 6: TRANSFORM AT TORKQ NODE (7800ms - 8700ms, 900ms)
      // ==========================================
      else if (elapsed < 8700) {
        if (beat !== 'TRANSFORM_TORKQ') {
          setBeat('TRANSFORM_TORKQ');
          setCardTransformed(true);
          flowDiagramRef.current?.setTorkqTransformed?.(true);
        }

        const bProgress = Math.min(1.0, (elapsed - 7800) / 900);
        setBorderProgress(bProgress);

        setCardPos({ x: tqAnchor.centerX, y: tqAnchor.centerY, scale: 1.0 });
        setCardOpacity(1.0);
        setConnectorLine({
          x: tqAnchor.centerX,
          y1: tqAnchor.cardEdgeY,
          y2: tqAnchor.nodeEdgeY,
          visible: true,
        });

        if (elapsed >= 8500 && !aiTargeted) {
          aiTargeted = true;
          flowDiagramRef.current?.setTorkqRhythmic(false);
          flowDiagramRef.current?.setNodeState('torkq', 'VISITED');
          flowDiagramRef.current?.setLegState('C', true);
          flowDiagramRef.current?.setNodeState('ai', 'TARGETED');
        }
      }
      // ==========================================
      // PAUSE TRANSFORM ON GREEN CARD: (8700ms - 9200ms)
      // ==========================================
      else if (elapsed < 9200) {
        if (beat !== 'PAUSE_TRANSFORM') setBeat('PAUSE_TRANSFORM');
        setBorderProgress(1.0);

        setCardPos({ x: tqAnchor.centerX, y: tqAnchor.centerY, scale: 1.0 });
        setCardOpacity(1.0);
        setConnectorLine({
          x: tqAnchor.centerX,
          y1: tqAnchor.cardEdgeY,
          y2: tqAnchor.nodeEdgeY,
          visible: true,
        });
      }
      // ==========================================
      // BEAT 7: → AI MODEL (9200ms - 9900ms, 700ms)
      // ==========================================
      else if (elapsed < 9900) {
        if (beat !== 'TRAVEL_AI') setBeat('TRAVEL_AI');

        const p0 = { x: tqAnchor.centerX, y: tqAnchor.centerY };
        const p1 = {
          x: aiAnchor.nodeBounds?.x || aiAnchor.centerX,
          y: aiAnchor.nodeBounds?.y || aiAnchor.centerY,
        };

        if (elapsed < 9750) {
          const t = arrivalSpring((elapsed - 9200) / 550, 550);
          const x = p0.x + (p1.x - p0.x) * t;
          const y = p0.y + (p1.y - p0.y) * t;

          setCardPos({ x, y, scale: 1.0 });
          setCardOpacity(1.0);
          setConnectorLine({ x: 0, y1: 0, y2: 0, visible: false });
        } else {
          // Absorbed directly into AI node
          flowDiagramRef.current?.setNodeState('ai', 'ACTIVE');
          const absT = (elapsed - 9750) / 150;
          const scale = 1.0 - absT * 0.6;
          const opacity = Math.max(0, 1.0 - absT);

          setCardPos({ x: p1.x, y: p1.y, scale });
          setCardOpacity(opacity);
          setConnectorLine({ x: 0, y1: 0, y2: 0, visible: false });

          if (elapsed >= 9850) {
            flowDiagramRef.current?.pulseAiNode?.();
          }
        }
      }
      // ==========================================
      // BEAT 8: DESCENT & REPORT ARRIVAL (9900ms+)
      // ==========================================
      else {
        finish();
        return;
      }

      animFrameRef.current = requestAnimationFrame(animateSequence);
    };

    animFrameRef.current = requestAnimationFrame(animateSequence);

    return () => {
      finishRef.current = null;
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [
    isActive,
    reducedMotion,
    promptText,
    findings,
    flowDiagramRef,
    chatboxRef,
    setState,
    setExposureScore,
    onSequenceComplete,
  ]);

  if (!isActive || beat === 'IDLE' || beat === 'COMPLETE') return null;

  // Helper to render prompt text with red highlighted findings as count increments
  const renderScanningText = () => {
    if (runningFoundCount === 0 || findings.length === 0) {
      return <span style={{ color: '#FFFFFF', opacity: 1.0 }}>{cardTextSnippet}</span>;
    }

    const activeFindings = findings.slice(0, runningFoundCount);
    const sorted = [...activeFindings].sort((a, b) => a.start - b.start);

    const elements: React.ReactNode[] = [];
    let lastIdx = 0;

    for (let i = 0; i < sorted.length; i++) {
      const f = sorted[i];
      if (f.start > lastIdx) {
        elements.push(
          <span key={`text-${lastIdx}`} style={{ color: '#FFFFFF', opacity: 1.0 }}>
            {cardTextSnippet.slice(lastIdx, f.start)}
          </span>
        );
      }
      const matchedSnippet = cardTextSnippet.slice(f.start, Math.min(cardTextSnippet.length, f.end));
      if (matchedSnippet) {
        elements.push(
          <span
            key={`found-${f.id}`}
            className="bg-red-500/40 text-white font-bold px-1.5 py-0.5 rounded border border-red-400"
            style={{ opacity: 1.0 }}
          >
            {matchedSnippet}
          </span>
        );
      }
      lastIdx = Math.max(lastIdx, f.end);
    }

    if (lastIdx < cardTextSnippet.length) {
      elements.push(
        <span key={`text-end`} style={{ color: '#FFFFFF', opacity: 1.0 }}>
          {cardTextSnippet.slice(lastIdx)}
        </span>
      );
    }

    return <>{elements}</>;
  };

  const isScanningOrTransformingAtTorkQ =
    beat === 'SCAN_TORKQ' ||
    beat === 'PAUSE_SCAN' ||
    beat === 'TRANSFORM_TORKQ' ||
    beat === 'PAUSE_TRANSFORM';

  // State-based outer glow and border formatting matching active node
  let stateColor = '#FF3B4E';
  let stateColorRgb = '255, 59, 78';

  if (beat === 'SCAN_TORKQ' || beat === 'PAUSE_SCAN') {
    stateColor = '#FFB020';
    stateColorRgb = '255, 176, 32';
  } else if (
    cardTransformed ||
    beat === 'TRANSFORM_TORKQ' ||
    beat === 'PAUSE_TRANSFORM' ||
    beat === 'TRAVEL_AI' ||
    beat === 'PAUSE_AI' ||
    beat === 'VERDICT'
  ) {
    stateColor = '#6DBE30';
    stateColorRgb = '109, 190, 48';
  } else {
    stateColor = '#FF3B4E';
    stateColorRgb = '255, 59, 78';
  }

  const blur60 = Math.round(60 * glowMultiplier);
  const blur24 = Math.round(24 * glowMultiplier);

  const cardBoxShadow = `0 0 ${blur60}px 0 rgba(${stateColorRgb}, 0.55), 0 0 ${blur24}px 0 rgba(${stateColorRgb}, 0.75), inset 0 0 30px 0 rgba(${stateColorRgb}, 0.10)`;

  const portalContent = (
    <>
      {/* SCREEN-READER STATUS — the visual choreography is decorative, so the
          progress has to be narrated separately. */}
      <div role="status" aria-live="polite" className="sr-only">
        {cardTransformed
          ? 'Scan complete. Payload sanitised. Preparing exposure report.'
          : `Scanning prompt. ${runningFoundCount} exposed ${
              runningFoundCount === 1 ? 'value' : 'values'
            } found so far.`}
      </div>

      {/* SKIP CONTROL — every transition must be leavable. Escape does the same. */}
      <button
        type="button"
        onClick={() => finishRef.current?.()}
        data-material="chrome"
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[10000] px-4 py-2 rounded-full border border-white/20 bg-black/60 backdrop-blur-xl text-neutral-200 hover:text-white hover:border-white/40 font-mono text-[11px] uppercase tracking-wider transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[#6DBE30] cursor-pointer"
      >
        Skip to results <span aria-hidden="true">(Esc)</span>
      </button>

      {/* OVERLAY CONTAINER FOR CARD & CONNECTOR (z-[9999]) */}
      <div
        className="fixed inset-0 z-[9999] pointer-events-none overflow-hidden"
        aria-hidden="true"
      >
        {/* VERTICAL CONNECTOR LINE BETWEEN CARD AND NODE */}
        {connectorLine.visible && (
          <svg
            className="fixed inset-0 w-full h-full pointer-events-none z-[9990]"
            style={{ position: 'fixed', left: 0, top: 0 }}
          >
            <style>{`
              @keyframes connectorDashFlow {
                from { stroke-dashoffset: 20; }
                to { stroke-dashoffset: 0; }
              }
            `}</style>
            <line
              x1={connectorLine.x}
              y1={connectorLine.y1}
              x2={connectorLine.x}
              y2={connectorLine.y2}
              stroke={stateColor}
              strokeWidth="2.5"
              strokeDasharray="6 4"
              style={{
                animation: 'connectorDashFlow 0.6s linear infinite',
                filter: `drop-shadow(0 0 10px rgba(${stateColorRgb}, 0.85))`,
                opacity: 1.0,
              }}
            />
            <circle
              cx={connectorLine.x}
              cy={connectorLine.y1}
              r="3.5"
              fill={stateColor}
              style={{ filter: `drop-shadow(0 0 6px rgba(${stateColorRgb}, 0.9))` }}
            />
            <circle
              cx={connectorLine.x}
              cy={connectorLine.y2}
              r="3.5"
              fill={stateColor}
              style={{ filter: `drop-shadow(0 0 6px rgba(${stateColorRgb}, 0.9))` }}
            />
          </svg>
        )}

        {/* FLYING PROMPT CARD — PORTALED TO DOCUMENT.BODY AT Z-9999 */}
        {!absorbedAtAi && cardOpacity > 0.02 && (
          <div
            ref={cardRef}
            className="fixed select-none pointer-events-none"
            style={{
              left: `${cardPos.x}px`,
              top: `${cardPos.y}px`,
              opacity: cardOpacity,
              background: '#0A0A0A',
              border: `3px solid ${stateColor}`,
              borderRadius: '12px',
              boxShadow: cardBoxShadow,
              padding: '20px 24px',
              minWidth: '360px',
              maxWidth: '460px',
              zIndex: 9999,
              backdropFilter: 'none',
              transform: `translate(-50%, -50%) scale(${cardPos.scale * scalePulse})`,
            }}
          >
            {/* CARD HEADER */}
            <div
              className="flex items-center justify-between gap-2 border-b pb-3 mb-3 font-mono"
              style={{
                borderColor: `rgba(${stateColorRgb}, 0.4)`,
              }}
            >
              <span
                className="uppercase flex items-center gap-1.5 font-semibold text-[13px] tracking-[0.12em]"
                style={{ color: stateColor, opacity: 1.0 }}
              >
                {cardTransformed ? '✓ SANITISED PAYLOAD' : '⚠️ RAW PROMPT PAYLOAD'}
              </span>
              {runningFoundCount > 0 && !cardTransformed && (
                <span
                  className="px-2 py-0.5 rounded font-bold border animate-pulse text-xs"
                  style={{
                    backgroundColor: `rgba(${stateColorRgb}, 0.25)`,
                    color: stateColor,
                    borderColor: stateColor,
                    opacity: 1.0,
                  }}
                >
                  {runningFoundCount} EXPOSED
                </span>
              )}
            </div>

            {/* CARD BODY TEXT (15px MONOSPACE, FULL BRIGHTNESS #FFFFFF / GREEN) */}
            <div
              className="relative overflow-hidden font-mono text-[15px] leading-relaxed font-medium"
              style={{ color: '#FFFFFF', opacity: 1.0 }}
            >
              {cardTransformed ? (
                <span
                  className="font-semibold text-[15px]"
                  style={{ color: stateColor, opacity: 1.0 }}
                >
                  {maskedPrompt(cardTextSnippet, findings)}
                </span>
              ) : (
                renderScanningText()
              )}

              {/* SCANLINE OVERLAY */}
              {beat === 'SCAN_TORKQ' && (
                <div
                  className="absolute left-0 right-0 h-1 shadow-[0_0_16px]"
                  style={{
                    top: `${scanlineProgress * 100}%`,
                    backgroundColor: stateColor,
                    boxShadow: `0 0 16px ${stateColor}`,
                  }}
                />
              )}
            </div>

            {/* SUB-LABELS BENEATH CARD TEXT DURING SCAN */}
            {isScanningOrTransformingAtTorkQ && (
              <div className="mt-3 pt-2.5 border-t border-white/20 font-mono text-xs space-y-1 text-neutral-200">
                {announceTier0 && (
                  <div className="text-amber-400 font-bold flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                    <span>✓ TIER 0 — pattern signatures</span>
                  </div>
                )}
                {announceTier1 && (
                  <div className="text-amber-300 font-bold flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-300 animate-ping" />
                    <span>✓ TIER 1 — entity recognition</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );

  return createPortal(portalContent, document.body);
};
