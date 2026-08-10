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

/**
 * Icon centres for the two cardless nodes, in their own node-local coordinates.
 * Each icon is drawn inside a group translated here, so the group's origin is
 * the icon's optical centre and a plain scale() pivots on the icon instead of
 * dragging it toward a corner.
 *
 * Monitor spans y -35..13 → -11. Bird spans y -46..10 → -18.
 */
const WORKSTATION_ICON_CY = -11;
const TORKQ_ICON_CY = -18;

/** Glow circles are drawn at this radius and scaled down to the state's size. */
const ICON_GLOW_R = 65;

/** Node centres, in viewBox user units. */
const NODE_X = { prompt: 110, workstation: 360, torkq: 610, ai: 860 } as const;
const NODE_Y = 125;

/** Breathing room between an element's own bounds and where a leg may reach. */
const CONNECT_PAD = 12;

/**
 * Where each leg meets an unboxed element: the icon's vertical centre, so the
 * line reads as attached to the monitor and the bird rather than cutting past
 * them at an arbitrary height. The boxed nodes keep their existing 115.
 */
const CONNECT_Y = {
  workstation: NODE_Y + WORKSTATION_ICON_CY,
  torkq: NODE_Y + TORKQ_ICON_CY,
} as const;

type Pt = { x: number; y: number };
type Rect = { x: number; y: number; w: number; h: number };
type Cubic = [Pt, Pt, Pt, Pt];

const lerpPt = (a: Pt, b: Pt, t: number): Pt => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});

const cubicAt = (c: Cubic, t: number): Pt => {
  const mt = 1 - t;
  const w0 = mt * mt * mt;
  const w1 = 3 * mt * mt * t;
  const w2 = 3 * mt * t * t;
  const w3 = t * t * t;
  return {
    x: w0 * c[0].x + w1 * c[1].x + w2 * c[2].x + w3 * c[3].x,
    y: w0 * c[0].y + w1 * c[1].y + w2 * c[2].y + w3 * c[3].y,
  };
};

/** de Casteljau — exact split, so the trimmed curve keeps the original shape. */
const splitCubic = (c: Cubic, t: number): [Cubic, Cubic] => {
  const p01 = lerpPt(c[0], c[1], t);
  const p12 = lerpPt(c[1], c[2], t);
  const p23 = lerpPt(c[2], c[3], t);
  const p012 = lerpPt(p01, p12, t);
  const p123 = lerpPt(p12, p23, t);
  const mid = lerpPt(p012, p123, t);
  return [
    [c[0], p01, p012, mid],
    [mid, p123, p23, c[3]],
  ];
};

const inRect = (p: Pt, r: Rect) =>
  p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;

/**
 * First t at which the curve crosses the rect boundary, in the given direction.
 * Coarse scan to bracket the crossing, then bisect — the curves here are
 * monotone enough in x that one crossing is all there is, and bisection keeps
 * it exact to well under a user unit.
 */
const crossingT = (c: Cubic, r: Rect, want: 'enter' | 'exit'): number | null => {
  const STEPS = 240;
  let prev = inRect(cubicAt(c, 0), r);
  if (want === 'exit' && !prev) return null;
  for (let i = 1; i <= STEPS; i++) {
    const t = i / STEPS;
    const now = inRect(cubicAt(c, t), r);
    const crossed = want === 'enter' ? now && !prev : !now && prev;
    if (crossed) {
      let lo = (i - 1) / STEPS;
      let hi = t;
      for (let k = 0; k < 40; k++) {
        const mid = (lo + hi) / 2;
        const insideMid = inRect(cubicAt(c, mid), r);
        const midIsPast = want === 'enter' ? insideMid : !insideMid;
        if (midIsPast) hi = mid;
        else lo = mid;
      }
      return hi;
    }
    prev = now;
  }
  return null;
};

/**
 * Cut away whatever falls inside the connection boundary at either end. The
 * path itself is shortened — the icon is not merely painted over the line — so
 * anything that follows the path (packets, arrowheads) stops at the boundary
 * too, for free.
 */
const trimCubic = (c: Cubic, startRect: Rect | null, endRect: Rect | null): Cubic => {
  let cur = c;
  if (startRect) {
    const t = crossingT(cur, startRect, 'exit');
    if (t !== null) cur = splitCubic(cur, t)[1];
  }
  if (endRect) {
    const t = crossingT(cur, endRect, 'enter');
    if (t !== null) cur = splitCubic(cur, t)[0];
  }
  return cur;
};

const cubicToPath = (c: Cubic) =>
  `M ${c[0].x.toFixed(2)} ${c[0].y.toFixed(2)} C ${c[1].x.toFixed(2)} ${c[1].y.toFixed(2)}, ` +
  `${c[2].x.toFixed(2)} ${c[2].y.toFixed(2)}, ${c[3].x.toFixed(2)} ${c[3].y.toFixed(2)}`;

/**
 * Untrimmed legs, drawn centre-to-edge. Each leg aims at the element's centre
 * so that once it is cut back to the boundary the remaining tangent — and with
 * it the arrowhead — still points at the element rather than off past it.
 */
const BASE_LEGS: Record<LegId, Cubic> = {
  A: [
    { x: 180, y: 115 },
    { x: 232, y: 104 },
    { x: 300, y: 114 },
    { x: NODE_X.workstation, y: CONNECT_Y.workstation },
  ],
  B: [
    { x: NODE_X.workstation, y: CONNECT_Y.workstation },
    { x: 460, y: 114 },
    { x: 575, y: 104 },
    { x: NODE_X.torkq, y: CONNECT_Y.torkq },
  ],
  C: [
    { x: NODE_X.torkq, y: CONNECT_Y.torkq },
    { x: 662, y: 99 },
    { x: 740, y: 114 },
    { x: 790, y: 115 },
  ],
};

/**
 * Leg captions ride just above their line. They sit lower than they used to
 * because the arcs are flatter: a leg has to reach the boundary already at the
 * icon's centre height, and a cubic cannot both arch steeply and arrive level.
 */
const LEG_LABEL_Y = 99;

/**
 * Packet opacity along a leg, in path units rather than percentages.
 *
 * A badge is anchored at its centre, so one sitting exactly on the boundary
 * still reaches half its own width back over the icon — a 44-wide token badge
 * overhangs the 12-unit pad by 10. Percentage fades cannot fix that, because
 * the overhang is a fixed distance and legs differ in length.
 *
 * So the badge is held at zero until its trailing edge has cleared the icon,
 * and only then ramps up. Nothing is ever painted, even faintly, on top of the
 * monitor or the bird.
 */
const PACKET_RAMP = 12;
const packetFade = (dist: number, total: number, halfWidth: number) => {
  const clear = Math.max(0, halfWidth - CONNECT_PAD);
  const rampIn = (dist - clear) / PACKET_RAMP;
  const rampOut = (total - dist - clear) / PACKET_RAMP;
  return Math.max(0, Math.min(1, rampIn, rampOut));
};

/**
 * How far along leg C the transforming packet sits. Not zero: at the boundary
 * the badge would overhang back onto the bird, which is exactly how the token
 * label ended up painted across the logo.
 */
const TRANSFORM_OFFSET = 18;

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

    /**
     * Workstation and TorkQ have no card, so there is no border to light and no
     * bloom to raise. Their spotlight is carried by the icon itself: a radial
     * glow behind it, its own opacity, and a scale step.
     *
     * ACTIVE wants a punch that settles rather than a step that holds, so the
     * scale is driven from a short-lived flag and the 300ms transform
     * transition does the settling — 1.12 on arrival, 1.05 once this clears.
     */
    const [iconPunch, setIconPunch] = useState<Record<'workstation' | 'torkq', boolean>>({
      workstation: false,
      torkq: false,
    });

    const wsState = nodeStates.workstation;
    const tqState = nodeStates.torkq;
    useEffect(() => {
      const timers: number[] = [];
      const arm = (id: 'workstation' | 'torkq', s: NodeState) => {
        if (s !== 'ACTIVE') {
          setIconPunch((prev) => (prev[id] ? { ...prev, [id]: false } : prev));
          return;
        }
        setIconPunch((prev) => (prev[id] ? prev : { ...prev, [id]: true }));
        timers.push(window.setTimeout(() => setIconPunch((prev) => ({ ...prev, [id]: false })), 200));
      };
      arm('workstation', wsState);
      arm('torkq', tqState);
      return () => timers.forEach((t) => clearTimeout(t));
    }, [wsState, tqState]);

    /** Icon-level equivalent of getNodeProps, for the two unboxed nodes. */
    const getIconProps = (id: 'workstation' | 'torkq') => {
      const nState = nodeStates[id];
      const color = getNodeColor(id);
      const rgb = getNodeRgb(id);
      const base = { color, rgb, dropShadow: undefined as string | undefined };

      if (nState === 'DORMANT') {
        return { ...base, iconOpacity: 0.55, iconScale: 1, glowRadius: 0, glowOpacity: 0 };
      }
      if (nState === 'TARGETED') {
        return { ...base, iconOpacity: 1, iconScale: 1.08, glowRadius: 45, glowOpacity: 0.35 };
      }
      if (nState === 'ACTIVE') {
        return {
          ...base,
          iconOpacity: 1,
          iconScale: iconPunch[id] ? 1.12 : 1.05,
          glowRadius: 65,
          glowOpacity: 0.55,
          dropShadow: `drop-shadow(0 0 9px rgba(${rgb}, 0.85))`,
        };
      }
      if (nState === 'VISITED') {
        return { ...base, iconOpacity: 1, iconScale: 1, glowRadius: 45, glowOpacity: 0.14 };
      }
      // NORMAL (ambient). TorkQ was the one node lit at rest before the cards
      // went; it keeps that by holding a faint glow, and the transform pulse
      // brightens it where it used to thicken the border.
      const ambientLit = id === 'torkq';
      return {
        ...base,
        iconOpacity: 1,
        iconScale: 1,
        glowRadius: ambientLit ? 48 : 0,
        glowOpacity: ambientLit ? (torkqPulse || torkqRhythmic ? 0.3 : 0.16) : 0,
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

    /**
     * The cardless nodes are measured from an explicit anchor rect rather than
     * their <g>. A group's client rect grows to cover everything inside it,
     * including the state glow and the ACTIVE drop-shadow — measuring the group
     * would move the payload card every time the node lit up, and by a
     * different amount per state. The anchor is fixed geometry, so the card
     * stays where it has always been.
     */
    const anchorWorkstationRef = useRef<SVGRectElement | null>(null);
    const anchorTorkqRef = useRef<SVGRectElement | null>(null);

    const anchorRefs: Partial<Record<NodeId, React.RefObject<SVGRectElement | null>>> = {
      workstation: anchorWorkstationRef,
      torkq: anchorTorkqRef,
    };

    /**
     * Connection boundaries for the two unboxed nodes: icon plus its label
     * block, padded. Measured rather than hard-coded because the label widths
     * come from whatever font actually resolves, which hard-coded numbers would
     * only guess at.
     *
     * Each getBBox() is taken on the element carrying the state scale, not on
     * its parent — getBBox excludes the element's own transform, so the
     * boundary is the icon's resting size and the legs do not twitch outward
     * every time a node scales up.
     */
    const svgRef = useRef<SVGSVGElement | null>(null);
    const wsIconRef = useRef<SVGGElement | null>(null);
    const wsTitleRef = useRef<SVGTextElement | null>(null);
    const tqIconRef = useRef<SVGGElement | null>(null);
    const tqTitleRef = useRef<SVGTextElement | null>(null);
    const tqSubtitleRef = useRef<SVGTextElement | null>(null);

    const [connectBounds, setConnectBounds] = useState<{
      workstation: Rect | null;
      torkq: Rect | null;
    }>({ workstation: null, torkq: null });

    const measureBounds = useCallback(() => {
      const union = (
        parts: { el: SVGGraphicsElement | null; dy?: number }[],
        originX: number,
      ): Rect | null => {
        let x0 = Infinity;
        let y0 = Infinity;
        let x1 = -Infinity;
        let y1 = -Infinity;
        for (const { el, dy = 0 } of parts) {
          if (!el) continue;
          let b: DOMRect;
          try {
            b = el.getBBox();
          } catch {
            continue;
          }
          if (!b.width && !b.height) continue;
          x0 = Math.min(x0, b.x);
          y0 = Math.min(y0, b.y + dy);
          x1 = Math.max(x1, b.x + b.width);
          y1 = Math.max(y1, b.y + b.height + dy);
        }
        if (!Number.isFinite(x0)) return null;
        return {
          x: originX + x0 - CONNECT_PAD,
          y: NODE_Y + y0 - CONNECT_PAD,
          w: x1 - x0 + CONNECT_PAD * 2,
          h: y1 - y0 + CONNECT_PAD * 2,
        };
      };

      setConnectBounds({
        workstation: union(
          [
            { el: wsIconRef.current, dy: WORKSTATION_ICON_CY },
            { el: wsTitleRef.current },
          ],
          NODE_X.workstation,
        ),
        torkq: union(
          [
            { el: tqIconRef.current, dy: TORKQ_ICON_CY },
            { el: tqTitleRef.current },
            { el: tqSubtitleRef.current },
          ],
          NODE_X.torkq,
        ),
      });
    }, []);

    useEffect(() => {
      measureBounds();
      // Text bboxes are font-dependent, so remeasure once webfonts settle.
      document.fonts?.ready.then(measureBounds).catch(() => {});
      const host = svgRef.current;
      if (!host || typeof ResizeObserver === 'undefined') return;
      const ro = new ResizeObserver(() => measureBounds());
      ro.observe(host);
      return () => ro.disconnect();
    }, [measureBounds]);

    /** Legs cut back to the boundaries. Boxed nodes pass null and keep their
     *  existing card-edge endpoints. */
    const legPaths = {
      A: cubicToPath(trimCubic(BASE_LEGS.A, null, connectBounds.workstation)),
      B: cubicToPath(trimCubic(BASE_LEGS.B, connectBounds.workstation, connectBounds.torkq)),
      C: cubicToPath(trimCubic(BASE_LEGS.C, connectBounds.torkq, null)),
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
        const measured = anchorRefs[id]?.current ?? nodeRefs[id]?.current ?? null;
        if (measured) {
          const rect = measured.getBoundingClientRect();
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
              const pt = pathC
                ? pathC.getPointAtLength(Math.min(TRANSFORM_OFFSET, pathC.getTotalLength()))
                : { x: 680, y: 115 };

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
                // The path now stops at the connection boundary, so a packet
                // reaching progress 1 is sitting right against the icon. Ease
                // it out there, and ease the next leg's packet in off the far
                // boundary, rather than popping either against the artwork.
                opacity: packetFade(
                  progress * totalLen,
                  totalLen,
                  (p.type === 'token' ? 44 : 24) / 2,
                ),
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

    // Cardless nodes take their spotlight from the icon, not a border.
    const workstationIcon = getIconProps('workstation');
    const torkqIcon = getIconProps('torkq');

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
          ref={svgRef}
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

            {/* Radial falloff standing in for the removed card bloom on the two
                unboxed nodes. Colour follows node state; size and strength are
                driven by the circle's own scale and opacity. */}
            {(['workstation', 'torkq'] as const).map((id) => (
              <radialGradient key={id} id={`icon-glow-${id}`}>
                <stop offset="0%" stopColor={getNodeColor(id)} stopOpacity="0.85" />
                <stop offset="45%" stopColor={getNodeColor(id)} stopOpacity="0.3" />
                <stop offset="100%" stopColor={getNodeColor(id)} stopOpacity="0" />
              </radialGradient>
            ))}
          </defs>

          {/* ----------------- THREE LEGS SVG PATHS ----------------- */}

          {/* ----------------------------------------------------------------
              Leg endpoints. Prompt and AI still have cards, so those two legs
              still stop at a card edge (180 and 790). Workstation and TorkQ do
              not, so legs meet *inside* those icons rather than stopping at the
              vanished card edges — A ends where B begins (360, the monitor's
              centre) and B ends where C begins (650, just clear of the bird).
              One continuous dashed line, split only for packet animation, with
              both junctions covered by the icon drawn over them.

              The B/C junction sits on the bird's centre rather than past it.
              Red has to enter the gateway and green has to leave it: put the
              junction beyond the mark and leg B's red arrowhead lands clear of
              the bird, reading as raw data coming back out. On the centre, red
              runs behind the left half, green leaves from the right, the
              arrowhead is covered by the body, and the transforming packet —
              which sits at leg C's start — pulses red to green on the mark
              itself.
              ---------------------------------------------------------------- */}

          {/* LEG A: PROMPT -> WORKSTATION (RED) */}
          <path
            ref={pathLegARef}
            d={legPaths.A}
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
            y={LEG_LABEL_Y}
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
                  d={legPaths.B}
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
                  y={LEG_LABEL_Y}
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
            d={legPaths.C}
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
            y={LEG_LABEL_Y}
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

          {/* NODE 2: WORKSTATION — no card. The <g> is deliberately unscaled:
              the icon scales on its own below, so the caption stays put and the
              anchor box stays a fixed size for getNodePosition. */}
          <g ref={nodeWorkstationRef} transform="translate(360, 125)">
            {/* Anchor only — no fill, no stroke, paints nothing. It preserves
                the footprint the payload card measures against, so removing the
                card does not drag the card down onto the icon. */}
            <rect ref={anchorWorkstationRef} x="-70" y="-60" width="140" height="120" fill="none" />

            <g transform={`translate(0, ${WORKSTATION_ICON_CY})`}>
              <circle
                r={ICON_GLOW_R}
                fill="url(#icon-glow-workstation)"
                className="transition-[opacity,transform] duration-300"
                style={{
                  opacity: workstationIcon.glowOpacity,
                  transform: `scale(${workstationIcon.glowRadius / ICON_GLOW_R})`,
                }}
              />

              {/* Monitor / Desktop Icon — coordinates shifted up by
                  WORKSTATION_ICON_CY so the group origin is the icon's centre
                  and the scale below pivots there. */}
              <g
                ref={wsIconRef}
                className="transition-[opacity,transform,filter] duration-300"
                style={{
                  opacity: workstationIcon.iconOpacity,
                  transform: `scale(${workstationIcon.iconScale})`,
                  filter: workstationIcon.dropShadow,
                }}
              >
                <rect
                  x="-28"
                  y="-24"
                  width="56"
                  height="38"
                  rx="3"
                  fill="none"
                  stroke={workstationProps.iconColor}
                  strokeWidth="1.5"
                />
                <path
                  d="M -12 14 L 12 14 M 0 14 L 0 24 M -15 24 L 15 24"
                  stroke={workstationProps.iconColor}
                  strokeWidth="1.5"
                />
                <circle cx="0" cy="-5" r="5" fill="#FF3B4E" />
              </g>
            </g>

            <text
              ref={wsTitleRef}
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

          {/* NODE 3: TORKQ GATEWAY (BRAND NODE) — no card, same structure as
              the workstation above. */}
          <g ref={nodeTorkqRef} transform="translate(610, 125)">
            {/* Anchor only — paints nothing. See the workstation node. */}
            <rect ref={anchorTorkqRef} x="-70" y="-60" width="140" height="120" fill="none" />

            <g transform={`translate(0, ${TORKQ_ICON_CY})`}>
              <circle
                r={ICON_GLOW_R}
                fill="url(#icon-glow-torkq)"
                className="transition-[opacity,transform] duration-300"
                style={{
                  opacity: torkqIcon.glowOpacity,
                  transform: `scale(${torkqIcon.glowRadius / ICON_GLOW_R})`,
                }}
              />

              {/* The mark is <BirdMark> rather than an <img> of /logo.svg,
                  which bakes in an opaque #030404 square — that square was the
                  tile that used to sit behind the bird. 64x56 holds the mark's
                  1.135 aspect; y=-28 centres it on this group's origin so the
                  scale below pivots on the bird rather than its corner.

                  Never tinted by state: the glow and caption carry red or
                  amber, the brand mark stays white and green. */}
              <g
                ref={tqIconRef}
                className="transition-[opacity,transform,filter] duration-300"
                style={{
                  opacity: torkqIcon.iconOpacity,
                  transform: `scale(${torkqIcon.iconScale})`,
                  filter: torkqIcon.dropShadow,
                }}
              >
                <BirdMark x="-32" y="-28" width="64" height="56" />
              </g>
            </g>

            {/* Wordmark over descriptor, matching the nav lockup. Fixed
                white/green/zinc — the state accent stops at the glow and the
                caption below. */}
            <text
              ref={tqTitleRef}
              x="0"
              y="30"
              fontSize="13"
              fontWeight="800"
              letterSpacing="0.14em"
              textAnchor="middle"
              style={{ opacity: torkqProps.textOpacity }}
            >
              <tspan fill="#FFFFFF">TORK</tspan>
              <tspan fill="#6DBE30">Q</tspan>
            </text>
            <text
              ref={tqSubtitleRef}
              x="0"
              y="44"
              fill="#A1A1AA"
              fontSize="10"
              fontWeight="400"
              textAnchor="middle"
              style={{ opacity: torkqProps.textOpacity }}
            >
              Gateway
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
