export function xyFromEvent(event) {

  const d = event?.interactionData?.destination
    ?? event?.interactionData?.origin
    ?? event?.data?.getLocalPosition?.(canvas.app.stage);

  if (!d) return { x: 0, y: 0 };

  return { x: d.x, y: d.y };
}

export function isNoteInside(note, { x, y }) {
  // note can be a Note (Placeable) or NoteDocument in some contexts.
  const obj = note?.object ?? note;

  // Best case: PIXI bounds exist
  const bounds = obj?.bounds ?? obj?._bounds;
  if (bounds?.contains) return bounds.contains(x, y);

  // Fallback: approximate a small hitbox around its position/center
  const cx = obj?.center?.x ?? obj?.x ?? 0;
  const cy = obj?.center?.y ?? obj?.y ?? 0;

  const half = 24; // heuristic hit radius; tweak if needed
  return x >= cx - half && x <= cx + half && y >= cy - half && y <= cy + half;
}

export class Line extends PIXI.Graphics {
  constructor({ x, y }) {
    super();
    this.style = {
      width: 5,
      color: 0xFF0000, // use number for PIXI
    };

    this.origin = { x, y };
    canvas.app.stage.addChild(this);
  }

  update({ x, y }) {
    this.clear();
    this.lineStyle(this.style.width, this.style.color);
    this.moveTo(this.origin.x, this.origin.y);
    this.lineTo(x, y);
  }

  clear() {
    super.clear();
    this.destroy({ children: true });
  }
}

export function getEdgeGivenTwoNodes(fromNode, toNode) {
  const dx = Math.abs(fromNode.x - toNode.x);
  const dy = Math.abs(fromNode.y - toNode.y);

  const UL = { x: 0, y: 0 };
  const UR = { x: dx, y: 0 };
  const LL = { x: 0, y: dy };
  const LR = { x: dx, y: dy };

  let origin, destination;
  if (fromNode.x <= toNode.x && fromNode.y <= toNode.y) {
    origin = UL; destination = LR;
  } else if (fromNode.x > toNode.x && fromNode.y <= toNode.y) {
    origin = UR; destination = LL;
  } else if (fromNode.x <= toNode.x && fromNode.y > toNode.y) {
    origin = LL; destination = UR;
  } else {
    origin = LR; destination = UL;
  }

  return {
    x: Math.min(fromNode.x, toNode.x),
    y: Math.min(fromNode.y, toNode.y),
    shape: {
      type: foundry.data.ShapeData.TYPES.POLYGON,
      width: dx,
      height: dy,
      points: [origin.x, origin.y, destination.x, destination.y],
    },
  };
}
