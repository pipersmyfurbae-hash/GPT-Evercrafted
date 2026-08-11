# Evercrafted Placement Engine Specification
Version: 1.0
Status: Developer Handoff Baseline

## Depends On
- EC-DOS-001
- EC-COMP-001
- EC-GRN-001

## Purpose
The Placement Engine transforms emotional and compositional intent into an editable blueprint structure before specific products are permanently assigned.

Architecture before decoration. Blueprint before render. Explainability over magic.

## Initial 24-Inch Wreath Test Composition

### Primary Anchor
- Default test location: approximately 7–9 o'clock.
- This is a reserved emotional focal zone.
- It may also require clearance for ribbon, bow, or other focal hardware.
- It must remain the dominant visual mass.

### Primary Sweep
- Begins from/near the anchor architecture.
- Travels upward and around the wreath in the selected design direction.
- It is a narrow guiding gesture rather than a continuous heavy band.
- Initial visual width target: approximately 15° as a starting test value, adjustable.

### Secondary Echo
- Initial test location: near 5 o'clock.
- It balances the anchor without becoming a second equal focal area.
- It should be visibly lighter/smaller than the anchor.
- It may repeat the focal species and focal color to create cohesion and balance.
- Repetition should function as an echo, not a mirror.

### Balance Rule
Asymmetry still requires balanced visual weight. The system should avoid an unresolved “half-moon” effect unless that formula is intentionally selected.

## Core Blueprint Objects
A wreath blueprint may contain:
- base shape;
- base diameter;
- wreath depth/base width;
- emotional profile;
- composition gravity;
- anchor pocket;
- hardware clearance;
- behavior paths;
- floral pockets;
- echo pocket(s);
- negative-space zones;
- floral roles;
- inventory assignments;
- render settings;
- explainability records;
- version metadata.

## Anchor Pocket Object
Suggested properties:
- id
- role = primary_anchor
- clock_start
- clock_end
- arc_degrees
- depth_ratio
- visual_weight
- hardware_clearance
- emotional_role
- locked
- explanation

Rule: exactly one primary anchor unless a later canon explicitly defines a multi-anchor composition formula.

## Behavior Path Object
Suggested properties:
- id
- behavior_type: cascading | sweeping | arching | bridging | nesting | framing
- start_angle
- end_angle
- width
- curvature
- strength
- radial_position
- depth_band
- priority
- explanation

## Pocket Object
Suggested properties:
- id
- pocket_type: anchor | support | echo | transition | rest
- clock_center
- arc_width
- radial_depth
- max_visual_weight
- floral_role_targets
- greenery_relationship
- negative_space_clearance
- explanation

## Engine Sequence
1. Create wreath base.
2. Read composition intent.
3. Establish composition gravity.
4. Reserve primary anchor.
5. Reserve hardware clearance.
6. Generate primary visual path.
7. Establish negative-space/rest zones.
8. Generate greenery behavior paths.
9. Create floral pockets from architecture.
10. Generate balancing/echo relationships.
11. Assign floral roles to pockets.
12. Validate hierarchy and balance.
13. Match inventory/materials.
14. Produce editable blueprint.
15. Produce render instructions.
16. Run quality review.

## Interaction Rules
- Moving the anchor triggers dependent recomputation of sweep, nearby pockets, balance, and negative-space relationships.
- Changing a behavior type should trigger partial reflow, not regenerate the entire design.
- User edits remain editable and traceable.
- A user may lock a component to prevent automatic reflow.
- Every engine-generated object must expose its reasoning.
- Manual changes should be captured with an optional “why I changed this” field for the learning system.

## Explainability
Clicking an object must answer:
- What is this?
- What role does it serve?
- Why is it here?
- Which canon rule caused or supports this decision?
- What downstream elements depend on it?

Example:
“Echo pocket near 5 o'clock balances the dominant 7–9 o'clock anchor. It repeats focal color/species at lower visual weight to create cohesion without creating a second focal point.”

## Blueprint Lifecycle
Draft → Composition Complete → Placement Complete → Inventory Assigned → Render Ready → Reviewed → Approved → Published/Exported

## Acceptance Criteria
- Exactly one primary anchor exists in the baseline composition.
- Anchor remains visually dominant.
- Hardware clearance remains unobstructed.
- Secondary echo never rivals anchor weight.
- Behavior paths do not create contradictory motion.
- Florals are assigned to pockets created by or integrated with greenery architecture.
- Negative space remains intentional.
- Blueprint can be saved, reloaded, and versioned.
- Every engine-generated object contains an explanation.
- Render instructions can be produced from saved blueprint data.
- User edits do not silently rewrite canon.

## Change Log
### v1.0
- Established baseline anchor, sweep, echo, blueprint objects, engine sequence, edit behavior, explainability, lifecycle, and acceptance criteria.
