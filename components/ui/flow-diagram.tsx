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
 * Where an icon sits inside a card, in node-local coordinates: above centre,
 * clear of the title the card carries under it.
 *
 * It is also the height the legs run at, so they meet all four nodes on one
 * line. The two unboxed icons are not offset by it — they fill the node box and
 * so are centred on it like the cards are — but the line still crosses them
 * well inside their artwork.
 */
const ICON_CY = -11;

/**
 * The shared node footprint. All four nodes occupy the same box, centred on
 * (NODE_X[id], NODE_Y): the two boxed nodes draw it as a card, the two unboxed
 * ones fill it with artwork. It is also the anchor rect the cardless nodes
 * report from getNodePosition, so the payload card hangs off one geometry.
 *
 * It is the prompt card's own 140 x 120, which the row is now measured off:
 * before this the two unboxed nodes carried 50-unit glyphs beside two 140-unit
 * cards and read as two different scales.
 */
const NODE_W = 140;
const NODE_H = 120;
const NODE_HALF_W = NODE_W / 2;
const NODE_HALF_H = NODE_H / 2;

/**
 * Icon sizes, taken from that box rather than from each other's bounding boxes.
 *
 * The monitor takes it whole: its old 56 x 48 outline is exactly the box's
 * aspect, so 2.5x lands on 140 x 120 with nothing left over. The coordinates
 * are written out at that size below rather than wrapped in a scale(), so the
 * stroke stays independent of it — a scaled 1.5 would arrive at 3.75 and read
 * far heavier than the card borders it now stands beside.
 *
 * The bird takes the same 2.5x, which leaves it the shade under the monitor it
 * always had: 110 against 120. It is a solid two-tone mass where the monitor is
 * an open outline, so matching their boxes makes the bird the heaviest thing in
 * the row, not an equal.
 */
const MONITOR_W = NODE_W;
const MONITOR_H = NODE_H;
const MONITOR_STROKE = 2.5;
const BIRD_H = 110;
/** The mark's own aspect, cropped to its bounds — set a height, width follows. */
const BIRD_ASPECT = 1.135;
const BIRD_W = Number((BIRD_H * BIRD_ASPECT).toFixed(2));

/**
 * The network icon grows by spread, not by blowing the whole glyph up: node
 * positions scale onto the baseline while the dots themselves grow only a
 * little. Scaling it whole turned four modest nodes into four blobs and put a
 * green hub three times the area of the monitor's red dot in the row — big
 * enough to pull the eye on its own. Spread carries the size; the nodes stay
 * in scale with their neighbours.
 */
const AI_NODE_X = 22.7;
const AI_NODE_Y = 17;
const AI_NODE_R = 4.2;
const AI_HUB_R = 6.6;

/**
 * Glow circles are drawn at this radius and scaled down to the state's size.
 * It tracks the icons: 65 was a halo around a 48-unit monitor, and would now
 * sit inside the monitor's own outline.
 */
const ICON_GLOW_R = 105;

/**
 * Node centre height, in viewBox user units. Every other vertical in the
 * diagram — leg heights, captions, the label baseline — is measured off it, so
 * the whole row moves together if it ever needs rebalancing in the box.
 */
const NODE_Y = 118;

/**
 * viewBox height.
 *
 * The node box runs 58..178 and the name under it lands at 196, with TorkQ's
 * second line at 210 — so the artwork occupies 58..213 and this leaves 58 units
 * of air above and 37 below. Not symmetric on purpose: the leg captions and the
 * packets ride above the node centre, so the visual mass sits high and the two
 * margins read even.
 */
const VB_H = 250;

/** Breathing room between an element's own bounds and where a leg may reach. */
const CONNECT_PAD = 12;

/**
 * Leg heights. LEVEL is the icons' vertical centre, where a leg meets an
 * unboxed element so the line reads as attached to the monitor and the bird
 * rather than cutting past them at an arbitrary height; CARD is where the two
 * boxed legs meet a card edge, a unit above it; ARCH is the flat rise between.
 */
const LEG_Y_LEVEL = NODE_Y + ICON_CY;
const LEG_Y_CARD = NODE_Y - 10;
const LEG_Y_ARCH = NODE_Y - 21;

/**
 * Node names sit on one baseline under all four nodes — 18 units below the
 * shared box, outside it, so a card's border and an unboxed icon's artwork both
 * clear it by the same amount. TorkQ's descriptor is the only second line.
 */
const LABEL_Y = NODE_HALF_H + 18;
const LABEL_SUB_Y = LABEL_Y + 14;
const LABEL_SIZE = 11;

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
 * The diagram is laid out to the content column it sits in, not to the viewport.
 * The section around it carries the same container and padding classes as the
 * hero and the chatbox, and the SVG fills that column exactly — so the viewBox
 * edges *are* the page's content guides.
 *
 * Which is why the outer nodes start half a node in: with the four boxes spread
 * evenly across the rest, the first and last sit flush against those guides and
 * there is nothing outside them left to bleed past. The legs take whatever gap
 * the spread leaves.
 *
 * One viewBox now serves every viewport. This used to carry two — 1000 units
 * under 1280px, 1280 above — sized so that a diagram free to grow with the
 * window kept its artwork in proportion. Pinned to a column of fixed width,
 * those two would render the same 900px at two different scales and step
 * visibly at the breakpoint.
 */
const VB_W = 980;

const NODE_PITCH = (VB_W - NODE_W) / 3;

const NODE_X: Record<NodeId, number> = {
  prompt: NODE_HALF_W,
  workstation: NODE_HALF_W + NODE_PITCH,
  torkq: NODE_HALF_W + NODE_PITCH * 2,
  ai: NODE_HALF_W + NODE_PITCH * 3,
};

/** Card edges the two boxed legs run from and to. */
const PROMPT_EDGE_X = NODE_X.prompt + NODE_HALF_W;
const AI_EDGE_X = NODE_X.ai - NODE_HALF_W;

/**
 * Untrimmed legs, drawn edge-to-centre. Each leg aims at the element's centre
 * so that once it is cut back to the boundary the remaining tangent — and with
 * it the arrowhead — still points at the element rather than off past it.
 *
 * Control points are placed at fractions of each leg's own span, so the arcs
 * keep their shape whatever the spread works out to.
 */
const legX = (from: number, to: number, t: number) => from + (to - from) * t;

const LEGS: Record<LegId, Cubic> = {
  A: [
    { x: PROMPT_EDGE_X, y: LEG_Y_CARD },
    { x: legX(PROMPT_EDGE_X, NODE_X.workstation, 0.29), y: LEG_Y_ARCH },
    { x: legX(PROMPT_EDGE_X, NODE_X.workstation, 0.67), y: LEG_Y_LEVEL },
    { x: NODE_X.workstation, y: LEG_Y_LEVEL },
  ],
  B: [
    { x: NODE_X.workstation, y: LEG_Y_LEVEL },
    { x: legX(NODE_X.workstation, NODE_X.torkq, 0.4), y: LEG_Y_LEVEL },
    { x: legX(NODE_X.workstation, NODE_X.torkq, 0.86), y: LEG_Y_ARCH },
    { x: NODE_X.torkq, y: LEG_Y_LEVEL },
  ],
  C: [
    { x: NODE_X.torkq, y: LEG_Y_LEVEL },
    { x: legX(NODE_X.torkq, AI_EDGE_X, 0.29), y: LEG_Y_ARCH },
    { x: legX(NODE_X.torkq, AI_EDGE_X, 0.72), y: LEG_Y_LEVEL },
    { x: AI_EDGE_X, y: LEG_Y_CARD },
  ],
};

/**
 * The scan pushes the diagram in while it owns the screen, as far as still
 * fits. The fit is now just the viewport over the rendered width: the nodes end
 * exactly at the SVG's edges, so nothing else has to be accounted for and no
 * card can be carried off-screen.
 */
const MAX_SCAN_ZOOM = 1.3;
const SCAN_ZOOM_MARGIN = 16;

const useScanZoom = (svgWidthPx: number): number => {
  const [zoom, setZoom] = useState(MAX_SCAN_ZOOM);

  useEffect(() => {
    if (!svgWidthPx) return;
    const compute = () => {
      const fit = (window.innerWidth - SCAN_ZOOM_MARGIN * 2) / svgWidthPx;
      setZoom(Math.max(1, Math.min(MAX_SCAN_ZOOM, fit)));
    };
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, [svgWidthPx]);

  return zoom;
};

/**
 * Leg captions ride just above their line. They sit lower than they used to
 * because the arcs are flatter: a leg has to reach the boundary already at the
 * icon's centre height, and a cubic cannot both arch steeply and arrive level.
 */
const LEG_LABEL_Y = NODE_Y - 26;

/** Height of the reduced-motion stand-in packets: on the line, under its caption. */
const STATIC_PACKET_Y = NODE_Y - 22;

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
    /** Rendered width of the SVG, i.e. of the content column. Measured, since
     *  the column's own cap is a class on the section rather than a number
     *  here. Feeds the scan zoom's fit. */
    const [svgWidthPx, setSvgWidthPx] = useState(0);
    const scanZoom = useScanZoom(svgWidthPx);
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
        // labelColor now drives each node's own name, which is white at rest
        // and takes the state colour only when the node lights up. TorkQ opts
        // out entirely — its wordmark is fixed white/green.
        labelColor: '#FFFFFF',
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
        return { ...base, iconOpacity: 1, iconScale: 1.08, glowRadius: 76, glowOpacity: 0.35 };
      }
      if (nState === 'ACTIVE') {
        return {
          ...base,
          iconOpacity: 1,
          iconScale: iconPunch[id] ? 1.12 : 1.05,
          glowRadius: ICON_GLOW_R,
          glowOpacity: 0.55,
          dropShadow: `drop-shadow(0 0 12px rgba(${rgb}, 0.85))`,
        };
      }
      if (nState === 'VISITED') {
        return { ...base, iconOpacity: 1, iconScale: 1, glowRadius: 76, glowOpacity: 0.14 };
      }
      // NORMAL (ambient). TorkQ was the one node lit at rest before the cards
      // went; it keeps that by holding a faint glow, and the transform pulse
      // brightens it where it used to thicken the border.
      const ambientLit = id === 'torkq';
      return {
        ...base,
        iconOpacity: 1,
        iconScale: 1,
        glowRadius: ambientLit ? 80 : 0,
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
          [{ el: wsIconRef.current }, { el: wsTitleRef.current }],
          NODE_X.workstation,
        ),
        torkq: union(
          [
            { el: tqIconRef.current },
            { el: tqTitleRef.current },
            { el: tqSubtitleRef.current },
          ],
          NODE_X.torkq,
        ),
      });
      const host = svgRef.current;
      if (host) setSvgWidthPx(host.getBoundingClientRect().width);
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
    const trimmedLegs: Record<LegId, Cubic> = {
      A: trimCubic(LEGS.A, null, connectBounds.workstation),
      B: trimCubic(LEGS.B, connectBounds.workstation, connectBounds.torkq),
      C: trimCubic(LEGS.C, connectBounds.torkq, null),
    };

    const legPaths = {
      A: cubicToPath(trimmedLegs.A),
      B: cubicToPath(trimmedLegs.B),
      C: cubicToPath(trimmedLegs.C),
    };

    /**
     * Where DATA / TOKENS sit. Taken from the middle of the *trimmed* leg, so a
     * caption stays centred on the line the eye actually sees rather than on
     * the untrimmed span — the two differ by the width of whatever icon and
     * label block the leg was cut back against.
     */
    const legLabelX: Record<LegId, number> = {
      A: cubicAt(trimmedLegs.A, 0.5).x,
      B: cubicAt(trimmedLegs.B, 0.5).x,
      C: cubicAt(trimmedLegs.C, 0.5).x,
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
                : { x: NODE_X.torkq + NODE_HALF_W, y: LEG_Y_CARD };

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
          transform: isZoomed ? `scale(${scanZoom})` : 'scale(1)',
          transformOrigin: 'center center',
          transition: 'transform 400ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
        /* No padding of its own, and no width cap of its own: the SVG has to
           span the content column exactly for the outer nodes to land on the
           page's guides, so the column is set by the caller's classes. */
        className={`relative w-full z-10 flex items-center justify-center ${className}`}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          className="w-full h-auto overflow-visible"
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
              Leg endpoints. Prompt and AI have cards, so those two legs stop at
              a card edge. Workstation and TorkQ do not, so legs meet *inside*
              those icons rather than at a card edge that is not there — A ends
              where B begins, on the monitor's centre, and B ends where C
              begins, on the bird's. One continuous dashed line, split only for
              packet animation, with both junctions covered by the icon drawn
              over them.

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
            x={legLabelX.A}
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
                  x={legLabelX.B}
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
            x={legLabelX.C}
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
            transform={`translate(${NODE_X.prompt}, ${NODE_Y}) scale(${promptProps.scale})`}
            style={{ opacity: promptProps.opacity }}
            className="transition-[opacity,transform] duration-300"
          >
            <rect
              x={-NODE_HALF_W}
              y={-NODE_HALF_H}
              width={NODE_W}
              height={NODE_H}
              rx="10"
              fill="#0A0A0A"
              stroke={promptProps.stroke}
              strokeWidth={promptProps.strokeWidth}
              style={{ filter: promptProps.filter }}
              className="transition-[stroke,stroke-width] duration-300"
            />
            {/* Document Icon — 38 x 48 about (-36, ICON_CY), the same silhouette
                as before (folded corner over a third of the width) drawn at the
                size that reads level with the monitor. It no longer sits as a
                header glyph over the ruled lines: at this size it is the node's
                icon, and the name and rules move into the column beside it. */}
            <path
              d="M -55 -35 L -29 -35 L -17 -23 L -17 13 L -55 13 Z"
              fill="none"
              stroke={promptProps.iconColor}
              strokeWidth="1.5"
              style={{ opacity: promptProps.iconOpacity }}
            />
            <text
              x="-9"
              y="-20"
              fill={promptProps.labelColor}
              fontSize="11"
              fontWeight="600"
              fontFamily="sans-serif"
              className="transition-[fill] duration-300"
              style={{ opacity: promptProps.textOpacity }}
            >
              Prompt Doc
            </text>

            {/* Faint Grey Lines */}
            <line x1="-9" y1="-8" x2="45" y2="-8" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
            <line x1="-9" y1="4" x2="28" y2="4" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />

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
          </g>

          {/* Its name, on the shared baseline. Deliberately a sibling of the
              node rather than a child: the group carries the state scale, and a
              label inside it would drop off the baseline by 10% of its own
              offset every time the node lit up. Same for the AI node below. */}
          <text
            x={NODE_X.prompt}
            y={NODE_Y + LABEL_Y}
            fill={promptProps.labelColor}
            fontSize={LABEL_SIZE}
            fontWeight="600"
            textAnchor="middle"
            className="transition-[fill] duration-300"
            style={{ opacity: promptProps.textOpacity }}
          >
            Prompt
          </text>

          {/* NODE 2: WORKSTATION — no card. The <g> is deliberately unscaled:
              the icon scales on its own below, so the name stays put and the
              anchor box stays a fixed size for getNodePosition. */}
          <g
            ref={nodeWorkstationRef}
            transform={`translate(${NODE_X.workstation}, ${NODE_Y})`}
          >
            {/* Anchor only — no fill, no stroke, paints nothing. It is the
                shared node box, so the payload card measures against the same
                footprint here as it does at a card. */}
            <rect
              ref={anchorWorkstationRef}
              x={-NODE_HALF_W}
              y={-NODE_HALF_H}
              width={NODE_W}
              height={NODE_H}
              fill="none"
            />

            {/* Centred on the node box, like a card — no ICON_CY offset, since
                the icon is the whole box rather than something sitting inside
                one above a title. */}
            <g>
              <circle
                r={ICON_GLOW_R}
                fill="url(#icon-glow-workstation)"
                className="transition-[opacity,transform] duration-300"
                style={{
                  opacity: workstationIcon.glowOpacity,
                  transform: `scale(${workstationIcon.glowRadius / ICON_GLOW_R})`,
                }}
              />

              {/* Monitor / Desktop Icon, at MONITOR_W x MONITOR_H — the same
                  drawing as before with every coordinate at 2.5x, so it fills
                  the node box instead of reading as a small glyph beside two
                  big cards. Spans the box symmetrically about the group origin,
                  so the state scale below pivots on its centre. */}
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
                  x={-MONITOR_W / 2}
                  y={-MONITOR_H / 2}
                  width={MONITOR_W}
                  height="95"
                  rx="7"
                  fill="none"
                  stroke={workstationProps.iconColor}
                  strokeWidth={MONITOR_STROKE}
                />
                <path
                  d="M -30 35 L 30 35 M 0 35 L 0 60 M -37 60 L 37 60"
                  stroke={workstationProps.iconColor}
                  strokeWidth={MONITOR_STROKE}
                />
                <circle cx="0" cy="-12.5" r="11" fill="#FF3B4E" />
              </g>
            </g>

            <text
              ref={wsTitleRef}
              x="0"
              y={LABEL_Y}
              fill={workstationProps.labelColor}
              fontSize={LABEL_SIZE}
              fontWeight="600"
              textAnchor="middle"
              className="transition-[fill] duration-300"
              style={{ opacity: workstationProps.textOpacity }}
            >
              Workstation
            </text>
          </g>

          {/* NODE 3: TORKQ GATEWAY (BRAND NODE) — no card, same structure as
              the workstation above. */}
          <g ref={nodeTorkqRef} transform={`translate(${NODE_X.torkq}, ${NODE_Y})`}>
            {/* Anchor only — paints nothing. See the workstation node. */}
            <rect
              ref={anchorTorkqRef}
              x={-NODE_HALF_W}
              y={-NODE_HALF_H}
              width={NODE_W}
              height={NODE_H}
              fill="none"
            />

            {/* Centred on the node box. See the workstation icon. */}
            <g>
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
                  tile that used to sit behind the bird. Drawn at BIRD_H, held
                  under the monitor because a solid mass this wide reads
                  heaviest at a matched box; x/y are half its size, which
                  centres it on this group's origin so the scale below pivots on
                  the bird rather than its corner.

                  Never tinted by state: the glow carries red or amber, the
                  brand mark stays white and green. */}
              <g
                ref={tqIconRef}
                className="transition-[opacity,transform,filter] duration-300"
                style={{
                  opacity: torkqIcon.iconOpacity,
                  transform: `scale(${torkqIcon.iconScale})`,
                  filter: torkqIcon.dropShadow,
                }}
              >
                <BirdMark
                  x={-BIRD_W / 2}
                  y={-BIRD_H / 2}
                  width={BIRD_W}
                  height={BIRD_H}
                />
              </g>
            </g>

            {/* Wordmark over descriptor, matching the nav lockup. Fixed
                white/green/zinc — alone among the four names it never takes the
                state colour; for TorkQ the accent stops at the glow. */}
            <text
              ref={tqTitleRef}
              x="0"
              y={LABEL_Y}
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
              y={LABEL_SUB_Y}
              fill="#A1A1AA"
              fontSize="10"
              fontWeight="400"
              textAnchor="middle"
              style={{ opacity: torkqProps.textOpacity }}
            >
              Gateway
            </text>
          </g>

          {/* NODE 4: AI MODEL */}
          <g
            ref={nodeAiRef}
            transform={`translate(${NODE_X.ai}, ${NODE_Y}) scale(${aiProps.scale})`}
            style={{ opacity: aiProps.opacity }}
            className="transition-[opacity,transform] duration-300"
          >
            <rect
              x={-NODE_HALF_W}
              y={-NODE_HALF_H}
              width={NODE_W}
              height={NODE_H}
              rx="10"
              fill="#0A0A0A"
              stroke={aiProps.stroke}
              strokeWidth={aiProps.strokeWidth}
              style={{ filter: aiProps.filter }}
              className="transition-[stroke,stroke-width] duration-300"
            />
            {/* Neural Network / Brain Synapses Icon — four nodes around a hub,
                on ICON_CY like the other three. Synapse strokes are 1.5, the
                monitor's weight, so the two outline-ish icons in the row read
                as one family. */}
            <g transform={`translate(0, ${ICON_CY})`}>
              {([[-1, -1], [1, -1], [-1, 1], [1, 1]] as const).map(([sx, sy]) => (
                <line
                  key={`syn-${sx}-${sy}`}
                  x1={sx * AI_NODE_X}
                  y1={sy * AI_NODE_Y}
                  x2="0"
                  y2="0"
                  stroke={aiProps.stroke}
                  strokeWidth="1.5"
                  style={{ opacity: aiProps.iconOpacity }}
                />
              ))}
              {([[-1, -1], [1, -1], [-1, 1], [1, 1]] as const).map(([sx, sy]) => (
                <circle
                  key={`node-${sx}-${sy}`}
                  cx={sx * AI_NODE_X}
                  cy={sy * AI_NODE_Y}
                  r={AI_NODE_R}
                  fill={aiProps.isLit ? '#FFFFFF' : '#A3A3A3'}
                />
              ))}
              <circle cx="0" cy="0" r={AI_HUB_R} fill="#6DBE30" />
            </g>

            <text
              x="0"
              y="32"
              fill={aiProps.labelColor}
              fontSize="11"
              fontWeight="600"
              textAnchor="middle"
              className="transition-[fill] duration-300"
              style={{ opacity: aiProps.textOpacity }}
            >
              LLM / Cloud AI
            </text>
          </g>

          {/* Name on the shared baseline; sibling of the node for the same
              reason as the prompt's. */}
          <text
            x={NODE_X.ai}
            y={NODE_Y + LABEL_Y}
            fill={aiProps.labelColor}
            fontSize={LABEL_SIZE}
            fontWeight="600"
            textAnchor="middle"
            className="transition-[fill] duration-300"
            style={{ opacity: aiProps.textOpacity }}
          >
            LLM
          </text>

          {/* ----------------- PACKET RENDERING ----------------- */}

          {/* Reduced Motion Static Fallback */}
          {reducedMotion ? (
            <g>
              {/* Static Red Packet Leg A */}
              <g transform={`translate(${legLabelX.A}, ${STATIC_PACKET_Y})`}>
                <rect x="-12" y="-6" width="24" height="12" rx="3" fill="#FF3B4E" />
                <text x="0" y="2" fill="#FFFFFF" fontSize="7" fontFamily="monospace" textAnchor="middle">
                  aX9
                </text>
              </g>

              {/* Static Red Packet Leg B */}
              <g transform={`translate(${legLabelX.B}, ${STATIC_PACKET_Y})`}>
                <rect x="-12" y="-6" width="24" height="12" rx="3" fill="#FF3B4E" />
                <text x="0" y="2" fill="#FFFFFF" fontSize="7" fontFamily="monospace" textAnchor="middle">
                  8#k
                </text>
              </g>

              {/* Static Green Token Leg C */}
              <g transform={`translate(${legLabelX.C}, ${STATIC_PACKET_Y})`}>
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
