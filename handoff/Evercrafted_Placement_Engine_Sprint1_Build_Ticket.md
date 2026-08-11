# Evercrafted Placement Engine — Sprint 1 Build Ticket
Version: 1.0
Priority: Immediate

## Sprint Name
Composition Canvas Foundation

## Goal
Build an interactive wreath blueprint canvas where a creator can define, edit, save, and reload the first Evercrafted placement skeleton.

## Sprint Scope

### 1. Canvas
Build:
- circular wreath canvas;
- default 24-inch base;
- clock-position overlay toggle;
- zoom;
- pan;
- layer rendering.

### 2. Primary Anchor Editor
Implement:
- anchor arc object;
- default test range 7–9 o'clock;
- adjustable start/end;
- adjustable depth;
- visual-weight property;
- hardware/bow clearance;
- lock/unlock.

### 3. Primary Sweep
Implement:
- editable path from anchor;
- sweeping behavior;
- adjustable start/end;
- adjustable curvature;
- adjustable width;
- initial narrow guiding band;
- live redraw.

### 4. Secondary Echo
Implement:
- default test location near 5 o'clock;
- size/weight ratio smaller than anchor;
- relationship to anchor;
- placeholder field for repeated focal color/species;
- lock/unlock.

### 5. Blueprint Data Model
Persist:
- base;
- anchor;
- hardware clearance;
- sweep;
- echo;
- object positions;
- dimensions;
- dependencies;
- explanations;
- version metadata.

### 6. Inspector
Selecting anchor, sweep, or echo displays:
- editable properties;
- explanation;
- dependency information.

### 7. Save / Load
Creator can:
- create blueprint;
- save blueprint;
- reload blueprint;
- retain all transforms and metadata.

### 8. Validation
Initial validators:
- one primary anchor;
- echo smaller than anchor;
- hardware clearance not obstructed;
- required explanation exists;
- saved blueprint schema is valid.

## Definition of Done
Sprint 1 is complete when a user can:
1. open a 24-inch wreath canvas;
2. see/toggle clock positions;
3. edit the 7–9 anchor;
4. edit the primary sweep;
5. edit the 5 o'clock echo;
6. see the relationships update visually;
7. select an object and see why it exists;
8. save the blueprint;
9. reopen it with the same state.

## Out of Scope for Sprint 1
Do not build yet:
- full inventory matching;
- full floral species selection;
- production rendering;
- marketplace;
- advanced AI memory parsing;
- automatic canon learning;
- complex multi-anchor formulas.

## Suggested Build Order
1. Blueprint schema
2. Canvas and coordinate system
3. Clock overlay
4. Anchor object/editor
5. Sweep path/editor
6. Echo object/editor
7. Inspector/explanation stub
8. Persistence
9. Validation
10. End-to-end test

## Developer Note
Do not treat the clock positions as hard-coded final design law. The 7–9 anchor and 5 o'clock echo are the first canonical test composition used to prove the engine mechanics. The architecture must remain flexible enough for later composition formulas.
