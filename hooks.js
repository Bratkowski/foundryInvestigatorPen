import { Line, xyFromEvent, isNoteInside } from "./canvas-utils.js";
import { InvestigatorPen } from "./core.js";

Hooks.on("getSceneControlButtons", (buttons) => {
  InvestigatorPen.onGetSceneControlButtons(buttons);
});

Hooks.once("init", () => {
  game.socket.on("module.investigator-pen", async (data) => {
    const { id, newEdges, noteId } = data;
    if (game.users.activeGM?.isSelf && noteId) {
      const existing = canvas.scene.notes.get(noteId)?.getFlag("investigator-pen", "investigator-pen-edges") ?? {};
      await canvas.scene.notes.get(noteId)?.setFlag("investigator-pen", "investigator-pen-edges", { ...existing, ...newEdges });
      await InvestigatorPen.drawEdge(id);
    }
  });
});

Hooks.on("libWrapper.Ready", () => {
  libWrapper.unregister_all("investigator-pen");

  libWrapper.register(
    "investigator-pen",
    "Note.prototype._canDrag",
    function (wrapped, ...args) {
      return wrapped(...args) || game.activeTool === "drawEdge";
    },
    "WRAPPER"
  );

  libWrapper.register(
    "investigator-pen",
    "Note.prototype._canDragLeftStart",
    function (wrapped, user, event) {
      if (game.activeTool === "drawEdge") return true;
      return wrapped(user, event);
    },
    "MIXED"
  );

  libWrapper.register(
    "investigator-pen",
    "Note.prototype._onDragLeftStart",
    function (wrapped, ...args) {
      if (game.activeTool !== "drawEdge") return wrapped(...args);

      InvestigatorPen.state.originNote = this;
      InvestigatorPen.state.pixiLine = new Line(this.center);
      InvestigatorPen.state.pixiLine.update(this.center);
      return;
    },
    "MIXED"
  );

  libWrapper.register(
    "investigator-pen",
    "Note.prototype._onDragLeftMove",
    function (wrapped, event) {
      if (game.activeTool === "drawEdge" && InvestigatorPen.state.pixiLine) {
        InvestigatorPen.state.pixiLine.update(xyFromEvent(event));
        return;
      }
      return wrapped(event);
    },
    "MIXED"
  );

  libWrapper.register(
    "investigator-pen",
    "Note.prototype._onDragLeftDrop",
    async function (wrapped, event) {
      if (game.activeTool === "drawEdge" && InvestigatorPen.state.originNote) {
        await _onDragLeftDrop(event);
        return;
      }
      return wrapped(event);
    },
    "MIXED"
  );

  libWrapper.register(
    "investigator-pen",
    "Note.prototype._onDragLeftCancel",
    async function (wrapped, event) {
      wrapped(event);
      InvestigatorPen.state.pixiLine?.destroy?.({ children: true });
      InvestigatorPen.state.pixiLine = null;
      InvestigatorPen.state.originNote = null;
    },
    "WRAPPER"
  );
});

async function _onDragLeftDrop(event) {
  try {
    const spot = xyFromEvent(event);

    const target = canvas.notes.placeables
      .filter(n => n.visible)
      .find(n => isNoteInside(n, spot));

    const origin = InvestigatorPen.state.originNote;

    if (target && origin && target.id !== origin.id) {
      await InvestigatorPen.createEdge(origin.id, { to: target.id });
    }
  } finally {
    InvestigatorPen.state.pixiLine?.destroy?.({ children: true });
    InvestigatorPen.state.pixiLine = null;
    InvestigatorPen.state.originNote = null;
  }
}

Hooks.on("updateNote", (note, change) => {
  if (!game.user.isGM) return;
  if (["x", "y"].some((c) => c in change)) {
    InvestigatorPen.updateEdgeDrawingsForNote(note);
  }
});

Hooks.on("preDeleteNote", async (note) => {
  await InvestigatorPen.deleteAllEdgesToAndFrom(note);
});

Hooks.on("preDeleteDrawing", async (drawing) => {
  await Promise.all(
    Object.entries(InvestigatorPen.allEdges)
      .filter(([_, edge]) => edge.drawingId === drawing.id)
      .map(([key]) => InvestigatorPen.deleteEdge(key))
  );
});
