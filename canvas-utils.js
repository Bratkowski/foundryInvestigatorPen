export function xyFromEvent(event) {
  const d =
    event?.interactionData?.destination ??
    event?.interactionData?.origin ??
    event?.data?.getLocalPosition?.(canvas.app.stage);

  if (!d) return { x: 0, y: 0 };
  return { x: d.x, y: d.y };
}

export function isNoteInside(note, { x, y }) {
  // note can be a Note (Placeable) or NoteDocument
  const obj = note?.object ?? note;

  // PIXI bounds (najlepszy przypadek)
  const bounds = obj?.bounds ?? obj?._bounds;
  if (bounds?.contains) return bounds.contains(x, y);

  // Fallback: hitbox wokół środka
  const cx = obj?.center?.x ?? obj?.x ?? 0;
  const cy = obj?.center?.y ?? obj?.y ?? 0;

  const half = 24; // OK heurystyka
  return (
    x >= cx - half &&
    x <= cx + half &&
    y >= cy - half &&
    y <= cy + half
  );
}

export class Line extends PIXI.Graphics {
  constructor({ x, y }) {
    super();

    this.style = {
      width: 5,
      color: 0xff0000,
    };

    this.origin = { x, y };
    canvas.app.stage.addChild(this);
  }

  update({ x, y }) {
    super.clear();
    this.lineStyle(this.style.width, this.style.color);
    this.moveTo(this.origin.x, this.origin.y);
    this.lineTo(x, y);
  }

  /** 
   * Czyści rysunek, ale NIE niszczy obiektu
   */
  clearLine() {
    super.clear();
  }

  /**
   * Jedyny poprawny sposób niszczenia linii
   */
  destroyLine() {
    try {
      super.clear();
    } catch (_) {}
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
