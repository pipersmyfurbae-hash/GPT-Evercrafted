# Evercrafted Placement Engine — UI / Wireframe Handoff
Version: 1.0

## Main Designer Workspace

### Left Panel — Layers / Structure
Display:
- Base
- Anchor
- Hardware clearance
- Behavior paths
- Greenery architecture
- Floral pockets
- Floral roles
- Echo elements
- Negative space
- Inventory assignments

Each layer can be shown/hidden and locked/unlocked.

### Center — Interactive Blueprint Canvas
Baseline:
- 24-inch circular wreath representation
- Toggleable clock overlay
- Zoom and pan
- Anchor arc visualization
- Behavior path visualization
- Pocket visualization
- Negative-space visualization
- Drag handles
- Live redraw

Initial test blueprint:
- Anchor: 7–9 o'clock
- Primary sweep: upward/around from anchor
- Echo: near 5 o'clock
- Clear space for bow/ribbon within anchor zone

### Right Panel — Inspector + Explainability
When an object is selected show:
- object type;
- role;
- position / arc;
- strength / weight;
- behavior;
- lock state;
- dependencies;
- why this exists;
- canon rule reference.

### Bottom Panel — Preview
Future-capable area for:
- realistic render preview;
- before/after compare;
- blueprint/render toggle;
- zoom;
- rotation;
- render status.

The blueprint remains the source of truth. The realistic render is downstream feedback, not the authority.

## Additional Views

### Behavior Editor
For each path:
- behavior type;
- strength;
- width;
- curvature;
- start/end;
- priority;
- explanation.

### Blueprint Inspector
Summary:
- base size;
- composition gravity;
- anchor;
- sweep;
- echo;
- behaviors;
- pockets;
- negative space;
- status;
- version.

### Version Diff
Side-by-side comparison of two blueprint versions:
- moved elements;
- changed paths;
- changed weights;
- changed inventory;
- reason notes;
- canon-impact flag.

## UX Principle
The interface should make the reasoning visible without forcing the user to read technical data unless they want it.
