import React, {
  useEffect,
  useRef,
  useState,
  useImperativeHandle,
  forwardRef,
  useCallback,
} from 'react';
import { useThemeState } from '../../lib/theme-state';
import { BirdMark } from './bird-mark';

export type NodeId = 'prompt' | 'workstation' | 'torkq' | 'ai';
export type NodeState = 'NORMAL' | 'DORMANT' | 'TARGETED' | 'ACTIVE' | 'VISITED';
export type LegId = 'A' | 'B' | 'C';

export interface FlowDiagramHandle {
  freezeAmbient: () => void;
  resumeAmbient: () => void;
  getNodePosition: (id: NodeId) => {
    x: number;
    y: number;
    top?: number;
    bottom?: number;
    left?: number;
    right?: number;
    width?: number;
    height?: number;
  };
  setNodeState: (id: NodeId, state: NodeState) => void;
  setAllNodeStates: (states: Partial<Record<NodeId, NodeState>>) => void;
  setLegState?: (leg: LegId, traversed: boolean) => void;
  setAllLegStates?: (states: Partial<Record<LegId, boolean>>) => void;
  setZoom: (zoomed: boolean) => void;
  setTorkqRhythmic: (active: boolean) => void;
  setTorkqTransformed?: (transformed: boolean) => void;
  pulseAi?: () => void;
  pulseAiNode?: () => void;
  resetFlow: () => void;
}

interface FlowDiagramProps {
  className?: string;
}

interface Packet {
  id: string;
  leg: 'A' | 'B' | 'C';
  startTime: number;
  duration: number; // ms
  type: 'data' | 'transforming' | 'token';
  glyph: string; // "aX9" or "[[PII_1]]"
  transformHoldStart?: number;
}

const TOKEN_LABELS = ['[[PII_1]]', '[[NAME_2]]', '[[CARD_3]]', '[[ID_4]]'];
const DATA_GLYPHS = ['aX9', '8#k', '7$m', 'p9@', 'x2!', '9&q'];

export const FlowDiagram = forwardRef<FlowDiagramHandle, FlowDiagramProps>(
  ({ className = '' }, ref) => {
    const { state, accent, accentRgb, reducedMotion } = useThemeState();
    const [manualFreeze, setManualFreeze] = useState(false);
    const [tokenIndex, setTokenIndex] = useState(0);

    // Glow intensity state for TorkQ node transformation pulse
    const [torkqPulse, setTorkqPulse] = useState(false);
    // Pulse state for AI node arrival
    const [aiPulse, setAiPulse] = useState(false);

    // Zoom state (1.0 -> 1.3)
    const [isZoomed, setIsZoomed] = useState(false);
    // TorkQ rhythmic pulse during scanning
    const [torkqRhythmic, setTorkqRhythmic] = useState(false);
    // TorkQ transformed state (red -> green)
    const [torkqTransformed, setTorkqTransformed] = useState(false);

    // Node spotlighting states
    const [nodeStates, setNodeStates] = useState<Record<NodeId, NodeState>>({
      prompt: 'NORMAL',
      workstation: 'NORMAL',
      torkq: 'NORMAL',
      ai: 'NORMAL',
    });

    // Leg states (traversed or not)
    const [legStates, setLegStates] = useState<Record<LegId, boolean>>({
      A: false,
      B: false,
      C: false,
    });

    // Helper to get stroke color per node
    const getNodeColor = (id: NodeId): string => {
      if (id === 'workstation' || id === 'prompt') {
        return '#FF3B4E';
      }
      if (id === 'torkq') {
        if (torkqTransformed) return '#6DBE30';
        if (torkqRhythmic) return '#FFB020';
        return '#FF3B4E';
      }
      if (id === 'ai') {
        return '#6DBE30';
      }
      return '#6DBE30';
    };

    const getNodeRgb = (id: NodeId): string => {
      const color = getNodeColor(id);
      if (color === '#6DBE30') return '109, 190, 48';
      if (color === '#FFB020') return '255, 176, 32';
      return '255, 59, 78';
    };

    // Helper to get visual properties per node
    const getNodeProps = (id: NodeId) => {
      const nState = nodeStates[id];
      const stroke = getNodeColor(id);
      const strokeRgb = getNodeRgb(id);

      if (nState === 'DORMANT') {
        return {
          nState,
          opacity: 0.35,
          scale: 1.0,
          stroke: 'rgba(255, 255, 255, 0.12)',
          strokeWidth: '1',
          filter: undefined,
          textOpacity: 0.4,
          iconOpacity: 0.4,
          iconColor: '#737373',
          labelColor: '#737373',
          labelOpacity: 0.4,
          isLit: false,
        };
      }
      if (nState === 'TARGETED') {
        return {
          nState,
          opacity: 1.0,
          scale: 1.05,
          stroke,
          strokeWidth: '2.5',
          filter: `drop-shadow(0 0 16px rgba(${strokeRgb}, 0.6))`,
          textOpacity: 1.0,
          iconOpacity: 1.0,
          iconColor: stroke,
          labelColor: stroke,
          labelOpacity: 1.0,
          isLit: true,
        };
      }
      if (nState === 'ACTIVE') {
        const glowFilter =
          stroke === '#6DBE30'
            ? 'url(#glow-green)'
            : stroke === '#FFB020'
            ? 'url(#glow-amber)'
            : 'url(#glow-red)';
        return {
          nState,
          opacity: 1.0,
          scale: 1.1,
          stroke,
          strokeWidth: '3',
          filter: glowFilter,
          textOpacity: 1.0,
          iconOpacity: 1.0,
          iconColor: '#FFFFFF',
          labelColor: stroke,
          labelOpacity: 1.0,
          isLit: true,
        };
      }
      if (nState === 'VISITED') {
        return {
          nState,
          opacity: 1.0,
          scale: 1.0,
          stroke: `rgba(${strokeRgb}, 0.45)`,
          strokeWidth: '2',
          filter: `drop-shadow(0 0 12px rgba(${strokeRgb}, 0.3))`,
          textOpacity: 0.9,
          iconOpacity: 0.85,
          iconColor: stroke,
          labelColor: stroke,
          labelOpacity: 0.8,
          isLit: true,
        };
      }
      // 'NORMAL' state (ambient)
      return {
        nState,
        opacity: 1.0,
        scale: 1.0,
        stroke: id === 'torkq' ? stroke : id === 'ai' && aiPulse ? '#6DBE30' : 'rgba(255, 255, 255, 0.25)',
        strokeWidth: id === 'torkq' ? (torkqPulse ? '3' : '2') : id === 'ai' && aiPulse ? '3' : '1.5',
        filter: id === 'torkq' || (id === 'ai' && aiPulse) ? `drop-shadow(0 0 16px rgba(${strokeRgb}, 0.5))` : undefined,
        textOpacity: 1.0,
        iconOpacity: 1.0,
        iconColor: '#A3A3A3',
        labelColor: id === 'torkq' ? stroke : '#E2E8F0',
        labelOpacity: 1.0,
        isLit: id === 'torkq',
      };
    };

    // Refs for SVG path elements
    const pathLegARef = useRef<SVGPathElement | null>(null);
    const pathLegBRef = useRef<SVGPathElement | null>(null);
    const pathLegCRef = useRef<SVGPathElement | null>(null);

    // Refs for Node DOM elements (used for getNodePosition)
    const nodePromptRef = useRef<SVGGElement | null>(null);
    const nodeWorkstationRef = useRef<SVGGElement | null>(null);
    const nodeTorkqRef = useRef<SVGGElement | null>(null);
    const nodeAiRef = useRef<SVGGElement | null>(null);

    const nodeRefs = {
      prompt: nodePromptRef,
      workstation: nodeWorkstationRef,
      torkq: nodeTorkqRef,
      ai: nodeAiRef,
    };

    // Active packets array ref
    const packetsRef = useRef<Packet[]>([]);
    // Active rendered packets state for React drawing
    const [renderedPackets, setRenderedPackets] = useState<
      {
        id: string;
        x: number;
        y: number;
        type: 'data' | 'transforming' | 'token';
        glyph: string;
        color: string;
        scale: number;
        opacity: number;
      }[]
    >([]);

    const animFrameRef = useRef<number | null>(null);
    const lastSpawnTimeRef = useRef<number>(0);

    // Check if ambient flow should be frozen
    const isFrozen = manualFreeze || state === 'scanning';

    // Expose Imperative Handle for Stage 4
    useImperativeHandle(ref, () => ({
      freezeAmbient: () => setManualFreeze(true),
      resumeAmbient: () => setManualFreeze(false),
      setNodeState: (id: NodeId, nState: NodeState) => {
        setNodeStates((prev) => ({ ...prev, [id]: nState }));
      },
      setAllNodeStates: (states: Partial<Record<NodeId, NodeState>>) => {
        setNodeStates((prev) => ({
          prompt: states.prompt !== undefined ? states.prompt : prev.prompt,
          workstation: states.workstation !== undefined ? states.workstation : prev.workstation,
          torkq: states.torkq !== undefined ? states.torkq : prev.torkq,
          ai: states.ai !== undefined ? states.ai : prev.ai,
        }));
      },
      setLegState: (leg: LegId, traversed: boolean) => {
        setLegStates((prev) => ({ ...prev, [leg]: traversed }));
      },
      setAllLegStates: (states: Partial<Record<LegId, boolean>>) => {
        setLegStates((prev) => ({
          A: states.A !== undefined ? states.A : prev.A,
          B: states.B !== undefined ? states.B : prev.B,
          C: states.C !== undefined ? states.C : prev.C,
        }));
      },
      setZoom: (zoomed: boolean) => setIsZoomed(zoomed),
      setTorkqRhythmic: (active: boolean) => setTorkqRhythmic(active),
      setTorkqTransformed: (transformed: boolean) => setTorkqTransformed(transformed),
      pulseAi: () => {
        setAiPulse(true);
        setTimeout(() => setAiPulse(false), 500);
      },
      pulseAiNode: () => {
        setAiPulse(true);
        setTimeout(() => setAiPulse(false), 500);
      },
      resetFlow: () => {
        setManualFreeze(false);
        setIsZoomed(false);
        setTorkqRhythmic(false);
        setTorkqTransformed(false);
        setNodeStates({
          prompt: 'NORMAL',
          workstation: 'NORMAL',
          torkq: 'NORMAL',
          ai: 'NORMAL',
        });
        setLegStates({
          A: false,
          B: false,
          C: false,
        });
      },
      getNodePosition: (id: NodeId) => {
        const nodeRef = nodeRefs[id];
        if (nodeRef && nodeRef.current) {
          const rect = nodeRef.current.getBoundingClientRect();
          return {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
            top: rect.top,
            bottom: rect.bottom,
            left: rect.left,
            right: rect.right,
            width: rect.width,
            height: rect.height,
          };
        }
        return { x: 0, y: 0, top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 };
      },
    }));

    // Helper to pick random data glyph
    const getRandomDataGlyph = useCallback(() => {
      return DATA_GLYPHS[Math.floor(Math.random() * DATA_GLYPHS.length)];
    }, []);

    // Main Packet Animation Loop
    useEffect(() => {
      if (reducedMotion) return;

      const DURATION = 2200; // Travel time ~2.2s per leg
      const SPAWN_INTERVAL = 2000; // Spawn interval ~2.0s

      const animate = (now: number) => {
        if (!isFrozen) {
          // Check if any packet on Leg A is within first 25% of path to prevent overlapping
          const legAPackets = packetsRef.current.filter((p) => p.leg === 'A');
          const hasClosePacketOnA = legAPackets.some((p) => {
            const elapsed = now - p.startTime;
            return elapsed / p.duration < 0.25;
          });

          if (!hasClosePacketOnA && now - lastSpawnTimeRef.current > SPAWN_INTERVAL) {
            lastSpawnTimeRef.current = now;

            const packetId = `fwd-A-${now}`;
            const newPacket: Packet = {
              id: packetId,
              leg: 'A',
              startTime: now,
              duration: DURATION,
              type: 'data',
              glyph: getRandomDataGlyph(),
            };

            packetsRef.current.push(newPacket);
          }

          // Update existing packets position & lifecycle
          const currentPackets = packetsRef.current;
          const nextPackets: Packet[] = [];
          const drawList: {
            id: string;
            x: number;
            y: number;
            type: 'data' | 'transforming' | 'token';
            glyph: string;
            color: string;
            scale: number;
            opacity: number;
          }[] = [];

          for (let i = 0; i < currentPackets.length; i++) {
            const p = currentPackets[i];
            const elapsed = now - p.startTime;

            if (p.type === 'transforming') {
              // Pulse at TorkQ node for 400ms hold with smooth color cross
              const transformElapsed = now - (p.transformHoldStart || now);
              const holdRatio = Math.min(1, transformElapsed / 400);

              // Position fixed at start of Leg C path
              const pathC = pathLegCRef.current;
              const pt = pathC ? pathC.getPointAtLength(0) : { x: 680, y: 115 };

              // Interpolate color smoothly from Red (#FF3B4E => 255, 59, 78) to Accent (accentRgb)
              const [tr, tg, tb] = accentRgb;
              const curR = Math.round(255 + (tr - 255) * holdRatio);
              const curG = Math.round(59 + (tg - 59) * holdRatio);
              const curB = Math.round(78 + (tb - 78) * holdRatio);
              const color = `rgb(${curR}, ${curG}, ${curB})`;

              drawList.push({
                id: p.id,
                x: pt.x,
                y: pt.y,
                type: 'transforming',
                glyph: p.glyph,
                color,
                scale: 1 + Math.sin(holdRatio * Math.PI) * 0.35,
                opacity: 1,
              });

              if (transformElapsed >= 400) {
                // Transition to Leg C Token packet
                setTokenIndex((prev) => (prev + 1) % TOKEN_LABELS.length);
                const nextTokenLabel = TOKEN_LABELS[tokenIndex];

                nextPackets.push({
                  id: `token-${now}`,
                  leg: 'C',
                  startTime: now,
                  duration: DURATION,
                  type: 'token',
                  glyph: nextTokenLabel,
                });
              } else {
                nextPackets.push(p);
              }
              continue;
            }

            const progress = Math.min(1, elapsed / p.duration);

            // Select corresponding path
            let pathEl: SVGPathElement | null = null;
            if (p.leg === 'A') pathEl = pathLegARef.current;
            else if (p.leg === 'B') pathEl = pathLegBRef.current;
            else if (p.leg === 'C') pathEl = pathLegCRef.current;

            if (pathEl) {
              const totalLen = pathEl.getTotalLength();
              const pt = pathEl.getPointAtLength(progress * totalLen);

              // Color: Leg A & B data packets are RED (#FF3B4E). Leg C token packets are GREEN (accent).
              const color = p.leg === 'C' || p.type === 'token' ? accent : '#FF3B4E';

              drawList.push({
                id: p.id,
                x: pt.x,
                y: pt.y,
                type: p.type,
                glyph: p.glyph,
                color,
                scale: 1.0,
                opacity: 1.0,
              });
            }

            if (progress < 1) {
              nextPackets.push(p);
            } else {
              // Reached destination of leg (One direction only: A -> B -> C -> Disappear)
              if (p.leg === 'A') {
                // Chain to Leg B
                nextPackets.push({
                  id: `legB-${now}`,
                  leg: 'B',
                  startTime: now,
                  duration: DURATION,
                  type: 'data',
                  glyph: getRandomDataGlyph(),
                });
              } else if (p.leg === 'B') {
                // Arrived at TorkQ: trigger 400ms transformation & pulse glow
                setTorkqPulse(true);
                setTimeout(() => setTorkqPulse(false), 450);

                nextPackets.push({
                  id: `trans-${now}`,
                  leg: 'B',
                  startTime: now,
                  duration: DURATION,
                  type: 'transforming',
                  glyph: TOKEN_LABELS[tokenIndex],
                  transformHoldStart: now,
                });
              }
              // Leg C completes at AI Model and disappears naturally (no reverse flow!)
            }
          }

          packetsRef.current = nextPackets;
          setRenderedPackets(drawList);
        }

        animFrameRef.current = requestAnimationFrame(animate);
      };

      animFrameRef.current = requestAnimationFrame(animate);

      return () => {
        if (animFrameRef.current !== null) {
          cancelAnimationFrame(animFrameRef.current);
        }
      };
    }, [isFrozen, reducedMotion, accent, accentRgb, tokenIndex, getRandomDataGlyph]);

    const promptProps = getNodeProps('prompt');
    const workstationProps = getNodeProps('workstation');
    const torkqProps = getNodeProps('torkq');
    const aiProps = getNodeProps('ai');

    return (
      <div
        style={{
          transform: isZoomed ? 'scale(1.3)' : 'scale(1)',
          transformOrigin: 'center center',
          transition: 'transform 400ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
        className={`relative w-full z-10 flex items-center justify-center p-2 sm:p-4 ${className}`}
      >
        <svg
          viewBox="0 0 1000 280"
          className="w-full max-w-[1000px] h-auto overflow-visible"
          aria-label="TorkQ Data Flow Diagram"
        >
          <defs>
            {/* Arrowhead Markers */}
            <marker
              id="arrow-red"
              viewBox="0 0 10 10"
              refX="6"
              refY="5"
              markerWidth="5"
              markerHeight="5"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#FF3B4E" />
            </marker>

            <marker
              id="arrow-green"
              viewBox="0 0 10 10"
              refX="6"
              refY="5"
              markerWidth="5"
              markerHeight="5"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill={accent} />
            </marker>

            {/* Glow Filters */}
            <filter id="glow-red" x="-150%" y="-150%" width="400%" height="400%">
              <feDropShadow dx="0" dy="0" stdDeviation="12" floodColor="#FF3B4E" floodOpacity="0.75" />
              <feDropShadow dx="0" dy="0" stdDeviation="30" floodColor="#FF3B4E" floodOpacity="0.55" />
            </filter>

            <filter id="glow-green" x="-150%" y="-150%" width="400%" height="400%">
              <feDropShadow dx="0" dy="0" stdDeviation="12" floodColor="#6DBE30" floodOpacity="0.75" />
              <feDropShadow dx="0" dy="0" stdDeviation="30" floodColor="#6DBE30" floodOpacity="0.55" />
            </filter>

            <filter id="glow-amber" x="-150%" y="-150%" width="400%" height="400%">
              <feDropShadow dx="0" dy="0" stdDeviation="12" floodColor="#FFB020" floodOpacity="0.75" />
              <feDropShadow dx="0" dy="0" stdDeviation="30" floodColor="#FFB020" floodOpacity="0.55" />
            </filter>

            <filter id="node-glow-soft" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>

            <filter id="torkq-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation={torkqPulse || torkqRhythmic ? '16' : '10'} result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* ----------------- THREE LEGS SVG PATHS ----------------- */}

          {/* LEG A: PROMPT -> WORKSTATION (RED) */}
          <path
            ref={pathLegARef}
            d="M 180 115 C 210 90, 260 90, 290 115"
            fill="none"
            stroke="#FF3B4E"
            strokeWidth={legStates.A ? "2.5" : "1.5"}
            strokeDasharray="4 4"
            markerEnd="url(#arrow-red)"
            style={{
              opacity: legStates.A ? 1.0 : 0.3,
              filter: legStates.A ? 'drop-shadow(0 0 8px rgba(255, 59, 78, 0.7))' : undefined,
              transition: 'all 300ms ease',
            }}
          />
          <text
            x="235"
            y="90"
            fill="#FF3B4E"
            fontSize={legStates.A ? "10" : "9"}
            fontFamily="monospace"
            fontWeight="bold"
            letterSpacing="0.15em"
            textAnchor="middle"
            style={{
              opacity: legStates.A ? 1.0 : 0.4,
              transition: 'all 300ms ease',
            }}
          >
            DATA
          </text>

          {/* LEG B: WORKSTATION -> TORKQ (RED / GREEN IF TRANSFORMED) */}
          {(() => {
            const legBColor = torkqTransformed ? '#6DBE30' : '#FF3B4E';
            const legBRgb = torkqTransformed ? '109, 190, 48' : '255, 59, 78';
            return (
              <>
                <path
                  ref={pathLegBRef}
                  d="M 430 115 C 460 90, 510 90, 540 115"
                  fill="none"
                  stroke={legBColor}
                  strokeWidth={legStates.B ? "2.5" : "1.5"}
                  strokeDasharray="4 4"
                  markerEnd={torkqTransformed ? "url(#arrow-green)" : "url(#arrow-red)"}
                  style={{
                    opacity: legStates.B ? 1.0 : 0.3,
                    filter: legStates.B ? `drop-shadow(0 0 8px rgba(${legBRgb}, 0.7))` : undefined,
                    transition: 'all 300ms ease',
                  }}
                />
                <text
                  x="485"
                  y="90"
                  fill={legBColor}
                  fontSize={legStates.B ? "10" : "9"}
                  fontFamily="monospace"
                  fontWeight="bold"
                  letterSpacing="0.15em"
                  textAnchor="middle"
                  style={{
                    opacity: legStates.B ? 1.0 : 0.4,
                    transition: 'all 300ms ease',
                  }}
                >
                  DATA
                </text>
              </>
            );
          })()}

          {/* LEG C: TORKQ -> AI MODEL (GREEN/ACCENT) */}
          <path
            ref={pathLegCRef}
            d="M 680 115 C 710 90, 760 90, 790 115"
            fill="none"
            stroke="#6DBE30"
            strokeWidth={legStates.C ? "2.5" : "1.5"}
            strokeDasharray="4 4"
            markerEnd="url(#arrow-green)"
            style={{
              opacity: legStates.C ? 1.0 : 0.3,
              filter: legStates.C ? 'drop-shadow(0 0 8px rgba(109, 190, 48, 0.7))' : undefined,
              transition: 'all 300ms ease',
            }}
          />
          <text
            x="735"
            y="90"
            fill="#6DBE30"
            fontSize={legStates.C ? "10" : "9"}
            fontFamily="monospace"
            fontWeight="bold"
            letterSpacing="0.15em"
            textAnchor="middle"
            style={{
              opacity: legStates.C ? 1.0 : 0.4,
              transition: 'all 300ms ease',
            }}
          >
            TOKENS
          </text>

          {/* ----------------- FOUR NODES ----------------- */}

          {/* NODE 1: PROMPT */}
          <g
            ref={nodePromptRef}
            transform={`translate(110, 125) scale(${promptProps.scale})`}
            style={{ opacity: promptProps.opacity }}
            className="transition-[opacity,transform] duration-300"
          >
            <rect
              x="-70"
              y="-60"
              width="140"
              height="120"
              rx="10"
              fill="#0A0A0A"
              stroke={promptProps.stroke}
              strokeWidth={promptProps.strokeWidth}
              style={{ filter: promptProps.filter }}
              className="transition-[stroke,stroke-width] duration-300"
            />
            {/* Header Document Icon */}
            <path
              d="M -50 -40 L -35 -40 L -27 -32 L -27 -15 L -50 -15 Z"
              fill="none"
              stroke={promptProps.iconColor}
              strokeWidth="1.5"
              style={{ opacity: promptProps.iconOpacity }}
            />
            <text
              x="-20"
              y="-25"
              fill="#FFFFFF"
              fontSize="11"
              fontWeight="600"
              fontFamily="sans-serif"
              style={{ opacity: promptProps.textOpacity }}
            >
              Prompt Doc
            </text>

            {/* Faint Grey Lines */}
            <line x1="-50" y1="-3" x2="40" y2="-3" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
            <line x1="-50" y1="7" x2="25" y2="7" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />

            {/* Highlighted Red Block: Sensitive Data */}
            <rect
              x="-55"
              y="18"
              width="110"
              height="30"
              rx="5"
              fill="rgba(255, 59, 78, 0.18)"
              stroke="rgba(255, 59, 78, 0.5)"
              strokeWidth="1"
            />
            <text x="-48" y="30" fill="#FF3B4E" fontSize="7.5" fontWeight="600" fontFamily="sans-serif">
              Sensitive Data — PII,
            </text>
            <text x="-48" y="39" fill="#FF3B4E" fontSize="7.5" fontWeight="500" fontFamily="sans-serif">
              confidential info
            </text>

            {/* Label Below Node */}
            <text
              x="0"
              y="82"
              fill={promptProps.labelColor}
              fontSize="10"
              fontFamily="monospace"
              fontWeight="bold"
              letterSpacing="0.1em"
              textAnchor="middle"
              style={{ opacity: promptProps.labelOpacity }}
            >
              1. PROMPT
            </text>
          </g>

          {/* NODE 2: WORKSTATION */}
          <g
            ref={nodeWorkstationRef}
            transform={`translate(360, 125) scale(${workstationProps.scale})`}
            style={{ opacity: workstationProps.opacity }}
            className="transition-[opacity,transform] duration-300"
          >
            <rect
              x="-70"
              y="-60"
              width="140"
              height="120"
              rx="10"
              fill="#0A0A0A"
              stroke={workstationProps.stroke}
              strokeWidth={workstationProps.strokeWidth}
              style={{ filter: workstationProps.filter }}
              className="transition-[stroke,stroke-width] duration-300"
            />
            {/* Monitor / Desktop Icon */}
            <rect
              x="-28"
              y="-35"
              width="56"
              height="38"
              rx="3"
              fill="none"
              stroke={workstationProps.iconColor}
              strokeWidth="1.5"
              style={{ opacity: workstationProps.iconOpacity }}
            />
            <path
              d="M -12 3 L 12 3 M 0 3 L 0 13 M -15 13 L 15 13"
              stroke={workstationProps.iconColor}
              strokeWidth="1.5"
              style={{ opacity: workstationProps.iconOpacity }}
            />
            <circle cx="0" cy="-16" r="5" fill="#FF3B4E" opacity="1.0" />

            <text
              x="0"
              y="32"
              fill="#FFFFFF"
              fontSize="11"
              fontWeight="600"
              textAnchor="middle"
              style={{ opacity: workstationProps.textOpacity }}
            >
              Workstation
            </text>

            {/* Label Below Node */}
            <text
              x="0"
              y="82"
              fill={workstationProps.labelColor}
              fontSize="10"
              fontFamily="monospace"
              fontWeight="bold"
              letterSpacing="0.1em"
              textAnchor="middle"
              style={{ opacity: workstationProps.labelOpacity }}
            >
              2. WORKSTATION
            </text>
          </g>

          {/* NODE 3: TORKQ GATEWAY (BRAND NODE) */}
          <g
            ref={nodeTorkqRef}
            transform={`translate(610, 125) scale(${torkqProps.scale})`}
            style={{ opacity: torkqProps.opacity }}
            className="transition-[opacity,transform] duration-300"
          >
            <rect
              x="-70"
              y="-60"
              width="140"
              height="120"
              rx="10"
              fill="#0A0A0A"
              stroke={torkqProps.stroke}
              strokeWidth={torkqProps.strokeWidth}
              style={{ filter: torkqProps.filter }}
              className="transition-[stroke,stroke-width] duration-300"
            />

            {/* TORKQ LOGO — a nested <svg> in the node's own user space rather
                than a foreignObject'd <img>. /logo.svg bakes in an opaque
                #030404 square, which read as a tile sitting on the node's
                #0A0A0A fill; <BirdMark> is that artwork with the rect dropped,
                so the node's own background shows through behind the bird.

                Box is 64x56 at x=-32,y=-46: the mark's 1.135 aspect held
                against the vertical space between the card's inner top (-58.5,
                after the 3px stroke) and the title's cap height (~24), leaving
                ~12 above and ~14 below. Width is deliberately not pushed
                further — the mark is wider than it is tall, so filling the
                card's width would drive it straight into the title.

                Never tinted by state: the border and label carry red/amber, the
                brand mark does not. */}
            <BirdMark x="-32" y="-46" width="64" height="56" />

            <text
              x="0"
              y="32"
              fill="#FFFFFF"
              fontSize="11"
              fontWeight="700"
              textAnchor="middle"
              style={{ opacity: torkqProps.textOpacity }}
            >
              TorkQ Gateway
            </text>

            {/* Label Below Node */}
            <text
              x="0"
              y="82"
              fill={torkqProps.labelColor}
              fontSize="10"
              fontFamily="monospace"
              fontWeight="bold"
              letterSpacing="0.1em"
              textAnchor="middle"
              style={{ opacity: torkqProps.labelOpacity }}
            >
              3. TORKQ
            </text>
          </g>

          {/* NODE 4: AI MODEL */}
          <g
            ref={nodeAiRef}
            transform={`translate(860, 125) scale(${aiProps.scale})`}
            style={{ opacity: aiProps.opacity }}
            className="transition-[opacity,transform] duration-300"
          >
            <rect
              x="-70"
              y="-60"
              width="140"
              height="120"
              rx="10"
              fill="#0A0A0A"
              stroke={aiProps.stroke}
              strokeWidth={aiProps.strokeWidth}
              style={{ filter: aiProps.filter }}
              className="transition-[stroke,stroke-width] duration-300"
            />
            {/* Neural Network / Brain Synapses Icon */}
            <g transform="translate(0, -12)">
              <circle cx="-16" cy="-12" r="3.5" fill={aiProps.isLit ? '#FFFFFF' : '#A3A3A3'} />
              <circle cx="16" cy="-12" r="3.5" fill={aiProps.isLit ? '#FFFFFF' : '#A3A3A3'} />
              <circle cx="0" cy="0" r="5.5" fill="#6DBE30" />
              <circle cx="-16" cy="12" r="3.5" fill={aiProps.isLit ? '#FFFFFF' : '#A3A3A3'} />
              <circle cx="16" cy="12" r="3.5" fill={aiProps.isLit ? '#FFFFFF' : '#A3A3A3'} />

              <line x1="-16" y1="-12" x2="0" y2="0" stroke={aiProps.stroke} strokeWidth="1.2" style={{ opacity: aiProps.iconOpacity }} />
              <line x1="16" y1="-12" x2="0" y2="0" stroke={aiProps.stroke} strokeWidth="1.2" style={{ opacity: aiProps.iconOpacity }} />
              <line x1="-16" y1="12" x2="0" y2="0" stroke={aiProps.stroke} strokeWidth="1.2" style={{ opacity: aiProps.iconOpacity }} />
              <line x1="16" y1="12" x2="0" y2="0" stroke={aiProps.stroke} strokeWidth="1.2" style={{ opacity: aiProps.iconOpacity }} />
            </g>

            <text
              x="0"
              y="32"
              fill="#FFFFFF"
              fontSize="11"
              fontWeight="600"
              textAnchor="middle"
              style={{ opacity: aiProps.textOpacity }}
            >
              LLM / Cloud AI
            </text>

            {/* Label Below Node */}
            <text
              x="0"
              y="82"
              fill={aiProps.labelColor}
              fontSize="10"
              fontFamily="monospace"
              fontWeight="bold"
              letterSpacing="0.1em"
              textAnchor="middle"
              style={{ opacity: aiProps.labelOpacity }}
            >
              4. AI MODEL
            </text>
          </g>

          {/* ----------------- PACKET RENDERING ----------------- */}

          {/* Reduced Motion Static Fallback */}
          {reducedMotion ? (
            <g>
              {/* Static Red Packet Leg A */}
              <g transform="translate(235, 103)">
                <rect x="-12" y="-6" width="24" height="12" rx="3" fill="#FF3B4E" />
                <text x="0" y="2" fill="#FFFFFF" fontSize="7" fontFamily="monospace" textAnchor="middle">
                  aX9
                </text>
              </g>

              {/* Static Red Packet Leg B */}
              <g transform="translate(485, 103)">
                <rect x="-12" y="-6" width="24" height="12" rx="3" fill="#FF3B4E" />
                <text x="0" y="2" fill="#FFFFFF" fontSize="7" fontFamily="monospace" textAnchor="middle">
                  8#k
                </text>
              </g>

              {/* Static Green Token Leg C */}
              <g transform="translate(735, 103)">
                <rect x="-22" y="-7" width="44" height="14" rx="3" fill={accent} />
                <text x="0" y="3" fill="#000000" fontSize="8" fontWeight="bold" fontFamily="monospace" textAnchor="middle">
                  [[PII_1]]
                </text>
              </g>
            </g>
          ) : (
            /* Live Animated Packets */
            renderedPackets.map((p) => {
              const isToken = p.type === 'token';
              const pWidth = isToken ? 44 : 24;
              const pHeight = isToken ? 14 : 11;
              const opacityVal = isFrozen ? 0 : p.opacity;

              return (
                <g
                  key={p.id}
                  transform={`translate(${p.x}, ${p.y}) scale(${p.scale})`}
                  style={{ opacity: opacityVal }}
                  className="transition-opacity duration-300"
                >
                  <rect
                    x={-pWidth / 2}
                    y={-pHeight / 2}
                    width={pWidth}
                    height={pHeight}
                    rx={3}
                    fill={p.color}
                    fillOpacity={isToken ? 0.95 : 0.85}
                    stroke={isToken ? '#FFFFFF' : 'rgba(255,255,255,0.3)'}
                    strokeWidth="0.8"
                  />
                  <text
                    x="0"
                    y="2.5"
                    fill={isToken ? '#000000' : '#FFFFFF'}
                    fontSize={isToken ? '8' : '7'}
                    fontWeight={isToken ? 'bold' : 'normal'}
                    fontFamily="monospace"
                    textAnchor="middle"
                  >
                    {p.glyph}
                  </text>
                </g>
              );
            })
          )}
        </svg>
      </div>
    );
  }
);

FlowDiagram.displayName = 'FlowDiagram';
