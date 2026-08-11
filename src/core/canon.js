/**
 * Citable canon registry.
 *
 * The Placement Engine Spec's Explainability section requires every object to
 * answer "Which canon rule caused or supports this decision?", and the UI
 * wireframe's right panel requires a "canon rule reference". A bare string like
 * "EC-COMP-001" does not answer that question for a creative director reading
 * the panel, so each rule carries its actual text.
 *
 * Rule text is quoted verbatim from the handoff documents. When a canon document
 * is versioned up, update the text here and bump `version` on the document entry.
 */

export const CANON_DOCS = {
  'EC-DOS-001': {
    id: 'EC-DOS-001',
    title: 'Evercrafted Design Operating System',
    version: '1.0',
  },
  'EC-COMP-001': {
    id: 'EC-COMP-001',
    title: 'Evercrafted Composition Canon',
    version: '1.0',
  },
  'EC-GRN-001': {
    id: 'EC-GRN-001',
    title: 'Evercrafted Greenery Architecture Canon',
    version: '1.0',
  },
  SPEC: {
    id: 'SPEC',
    title: 'Evercrafted Placement Engine Specification',
    version: '1.0',
  },
  TICKET: {
    id: 'TICKET',
    title: 'Placement Engine Sprint 1 Build Ticket',
    version: '1.0',
  },
};

export const CANON_RULES = {
  /* ---------------- EC-DOS-001 ---------------- */
  'DOS.P1': {
    doc: 'EC-DOS-001',
    section: 'Core Principles 1',
    text: 'Every design decision must be explainable.',
  },
  'DOS.P3': {
    doc: 'EC-DOS-001',
    section: 'Core Principles 3',
    text: 'Each engine narrows possibility; it does not add randomness.',
  },
  'DOS.P4': {
    doc: 'EC-DOS-001',
    section: 'Core Principles 4',
    text: 'Preserve optionality as long as possible. Early engines define intent and roles before locking materials.',
  },
  'DOS.P5': {
    doc: 'EC-DOS-001',
    section: 'Core Principles 5',
    text: 'Human creative judgment is final.',
  },
  'DOS.P6': {
    doc: 'EC-DOS-001',
    section: 'Core Principles 6',
    text: 'A human edit is not automatically a new rule. The system must capture why the edit improved the design before the canon changes.',
  },

  /* ---------------- EC-COMP-001 ---------------- */
  'COMP.L1': {
    doc: 'EC-COMP-001',
    section: 'Foundational Laws 1',
    text: 'Every design establishes a clear emotional anchor.',
  },
  'COMP.L2': {
    doc: 'EC-COMP-001',
    section: 'Foundational Laws 2',
    text: 'The anchor is the beginning of the eye path, not the entire story.',
  },
  'COMP.L3': {
    doc: 'EC-COMP-001',
    section: 'Foundational Laws 3',
    text: 'Every composition defines an intentional visual journey.',
  },
  'COMP.L4': {
    doc: 'EC-COMP-001',
    section: 'Foundational Laws 4',
    text: 'Every journey contains moments of rest.',
  },
  'COMP.L5': {
    doc: 'EC-COMP-001',
    section: 'Foundational Laws 5',
    text: 'Negative space is an active design element.',
  },
  'COMP.L6': {
    doc: 'EC-COMP-001',
    section: 'Foundational Laws 6',
    text: 'Greenery creates architecture; flowers inhabit that architecture.',
  },
  'COMP.L7': {
    doc: 'EC-COMP-001',
    section: 'Foundational Laws 7',
    text: 'Flowers reinforce movement that already exists instead of inventing it independently.',
  },
  'COMP.L9': {
    doc: 'EC-COMP-001',
    section: 'Foundational Laws 9',
    text: 'Every element must earn its place.',
  },
  'COMP.L10': {
    doc: 'EC-COMP-001',
    section: 'Foundational Laws 10',
    text: 'Elements must be in visual conversation with other elements.',
  },
  'COMP.L11': {
    doc: 'EC-COMP-001',
    section: 'Foundational Laws 11',
    text: 'Composition is relationships, not coordinates.',
  },
  'COMP.L12': {
    doc: 'EC-COMP-001',
    section: 'Foundational Laws 12',
    text: 'A design is not complete merely because every area is filled.',
  },
  'COMP.GRAVITY': {
    doc: 'EC-COMP-001',
    section: 'Composition Gravity',
    text: 'Every design has a center of visual/emotional gravity. This is not necessarily the geometric center. Composition gravity is established before species selection.',
  },
  'COMP.BALANCE': {
    doc: 'EC-COMP-001',
    section: 'Validation Questions',
    text: 'Is visual weight balanced without requiring mirror symmetry?',
  },

  /* ---------------- EC-GRN-001 ---------------- */
  'GRN.L1': {
    doc: 'EC-GRN-001',
    section: 'Core Laws 1',
    text: 'Greenery architecture is established before floral placement.',
  },
  'GRN.L2': {
    doc: 'EC-GRN-001',
    section: 'Core Laws 2',
    text: 'Greenery defines movement; florals reinforce it.',
  },
  'GRN.L3': {
    doc: 'EC-GRN-001',
    section: 'Core Laws 3',
    text: 'Greenery creates pockets; flowers inhabit those pockets.',
  },
  'GRN.L5': {
    doc: 'EC-GRN-001',
    section: 'Core Laws 5',
    text: 'Greenery connects the composition and prevents isolated clusters.',
  },
  'GRN.L7': {
    doc: 'EC-GRN-001',
    section: 'Core Laws 7',
    text: 'Use only the material needed to make the structural gesture readable.',
  },
  'GRN.L9': {
    doc: 'EC-GRN-001',
    section: 'Core Laws 9',
    text: 'Behavior is selected before species.',
  },
  'GRN.B01': {
    doc: 'EC-GRN-001',
    section: 'GRN-B01 Cascading',
    text: 'Controlled downward movement. Curving or arcing stems that gradually descend rather than dropping as a stiff vertical line.',
  },
  'GRN.B02': {
    doc: 'EC-GRN-001',
    section: 'GRN-B02 Sweeping',
    text: 'Carry the eye laterally around the wreath form and connect zones. Long directional movement following the circular form. Thin, readable gesture; never a hedge of greenery.',
  },
  'GRN.B03': {
    doc: 'EC-GRN-001',
    section: 'GRN-B03 Arching',
    text: 'Create upward or outward lift and frame open space. Rising curved lines. The arch supports or frames space without becoming vertical dominance.',
  },
  'GRN.B04': {
    doc: 'EC-GRN-001',
    section: 'GRN-B04 Bridging',
    text: 'Connect two pockets or movements subtly. Stitching, not scaffolding. If the bridge becomes a focal feature, it is too heavy.',
  },
  'GRN.B05': {
    doc: 'EC-GRN-001',
    section: 'GRN-B05 Nesting',
    text: 'Cradle a flower or micro-cluster so it feels held and secure. Support the pocket without creating a rigid ring around it.',
  },
  'GRN.B06': {
    doc: 'EC-GRN-001',
    section: 'GRN-B06 Framing',
    text: 'Define the edge or boundary of the visual story. Readable edge with minimal material; never compete with the anchor.',
  },

  /* ---------------- Placement Engine Spec ---------------- */
  'SPEC.ANCHOR': {
    doc: 'SPEC',
    section: 'Primary Anchor',
    text: 'Default test location: approximately 7-9 o\'clock. This is a reserved emotional focal zone. It may also require clearance for ribbon, bow, or other focal hardware. It must remain the dominant visual mass.',
  },
  'SPEC.ANCHOR.ONE': {
    doc: 'SPEC',
    section: 'Anchor Pocket Object',
    text: 'Exactly one primary anchor unless a later canon explicitly defines a multi-anchor composition formula.',
  },
  'SPEC.SWEEP': {
    doc: 'SPEC',
    section: 'Primary Sweep',
    text: 'Begins from/near the anchor architecture. Travels upward and around the wreath in the selected design direction. It is a narrow guiding gesture rather than a continuous heavy band. Initial visual width target: approximately 15 degrees as a starting test value, adjustable.',
  },
  'SPEC.ECHO': {
    doc: 'SPEC',
    section: 'Secondary Echo',
    text: 'Initial test location: near 5 o\'clock. It balances the anchor without becoming a second equal focal area. It should be visibly lighter/smaller than the anchor. It may repeat the focal species and focal color to create cohesion and balance. Repetition should function as an echo, not a mirror.',
  },
  'SPEC.BALANCE': {
    doc: 'SPEC',
    section: 'Balance Rule',
    text: 'Asymmetry still requires balanced visual weight. The system should avoid an unresolved "half-moon" effect unless that formula is intentionally selected.',
  },
  'SPEC.HARDWARE': {
    doc: 'SPEC',
    section: 'Engine Sequence 5 / Acceptance Criteria',
    text: 'Reserve hardware clearance. Hardware clearance remains unobstructed.',
  },
  'SPEC.REFLOW': {
    doc: 'SPEC',
    section: 'Interaction Rules',
    text: 'Moving the anchor triggers dependent recomputation of sweep, nearby pockets, balance, and negative-space relationships.',
  },
  'SPEC.LOCK': {
    doc: 'SPEC',
    section: 'Interaction Rules',
    text: 'A user may lock a component to prevent automatic reflow.',
  },
  'SPEC.EXPLAIN': {
    doc: 'SPEC',
    section: 'Explainability',
    text: 'Clicking an object must answer: What is this? What role does it serve? Why is it here? Which canon rule caused or supports this decision? What downstream elements depend on it?',
  },
  'SPEC.WHY': {
    doc: 'SPEC',
    section: 'Interaction Rules',
    text: 'Manual changes should be captured with an optional "why I changed this" field for the learning system.',
  },
  'SPEC.PERSIST': {
    doc: 'SPEC',
    section: 'Acceptance Criteria',
    text: 'Blueprint can be saved, reloaded, and versioned.',
  },
  'SPEC.DOMINANT': {
    doc: 'SPEC',
    section: 'Acceptance Criteria',
    text: 'Anchor remains visually dominant. Secondary echo never rivals anchor weight.',
  },
  'SPEC.NEGSPACE': {
    doc: 'SPEC',
    section: 'Acceptance Criteria',
    text: 'Negative space remains intentional.',
  },

  /* ---------------- Sprint 1 ticket ---------------- */
  'TICKET.FLEX': {
    doc: 'TICKET',
    section: 'Developer Note',
    text: 'Do not treat the clock positions as hard-coded final design law. The 7-9 anchor and 5 o\'clock echo are the first canonical test composition used to prove the engine mechanics. The architecture must remain flexible enough for later composition formulas.',
  },
  'TICKET.BASE': {
    doc: 'TICKET',
    section: 'Sprint Scope 1 - Canvas',
    text: 'Circular wreath canvas; default 24-inch base; clock-position overlay toggle; zoom; pan; layer rendering.',
  },
};

/** Look up a rule, returning a display-ready record. */
export function getRule(ruleId) {
  const rule = CANON_RULES[ruleId];
  if (!rule) return null;
  const doc = CANON_DOCS[rule.doc];
  return {
    id: ruleId,
    label: `${doc.id} - ${rule.section}`,
    docTitle: doc.title,
    docVersion: doc.version,
    text: rule.text,
  };
}

/** Resolve a list of rule ids, silently dropping unknown ones. */
export function getRules(ruleIds = []) {
  return ruleIds.map(getRule).filter(Boolean);
}
