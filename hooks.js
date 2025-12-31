import { isNoteInside, Line, xyFromEvent } from "./canvas-utils.js";
import { InvestigatorPen } from "./core.js";

function controlledNotesCount() {
  return Array.isArray(canvas?.notes?.controlled) ? canvas.notes.controlled.length : 0;
}


// Inject tool into notes controls
Hooks.on("getSceneControlButtons", (buttons) => {
  InvestigatorPen.onGetSceneControlButtons(buttons);
});

Hooks.once("init", () => {
  game.socket.on("module.investigator-pen", async (data) => {
    const { id, newEdges, noteId } = data;
    if (game.users.activeGM?.isSelf && noteId) {
      await canvas?.scene.notes
        .get(noteId)
        ?.setFlag("investigator-pen", "investigator-pen-edges", newEdges);
      InvestigatorPen.drawEdge(id);
    }
  });
});

Hooks.on("libWrapper.Ready", () => {
  // Reset all the wrappers for this module:
  libWrapper.unregister_all("investigator-pen");

  // Handle drags from note:
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
      if (game.activeTool === "drawEdge") {
        if (controlledNotesCount() === 1) {
          InvestigatorPen.state.originNote = this;
          InvestigatorPen.state.pixiLine = new Line(this.center);
          const spot = this.center;
          InvestigatorPen.state.pixiLine.update(spot);
          return;
        } else {
  console.log("controlledNotesCount", controlledNotesCount()); 
          ui.notifications.warn(`You must have only 1 note selected.`);
        }
      } else {
        return wrapped(...args);
      }
    },
    "MIXED"
  );
  libWrapper.register(
    "investigator-pen",
    "Note.prototype._onDragLeftMove",
    (wrapped, event) => {
      if (game.activeTool === "drawEdge") {
        if (controlledNotesCount() === 1) {
          const spot = xyFromEvent(event);
          InvestigatorPen.state.pixiLine.update(spot);
          return;
        }
      } else {
        return wrapped(event);
      }
    },
    "MIXED"
  );
  libWrapper.register(
    "investigator-pen",
    "Note.prototype._onDragLeftCancel",
    async (wrapped, event) => {
      wrapped(event);
      InvestigatorPen.state.pixiLine?.clear();
      InvestigatorPen.state.pixiLine = null;
    },
    "WRAPPER"
  );
  libWrapper.register(
    "investigator-pen",
    "Note.prototype._onDragLeftDrop",
    async (wrapped, event) => {
if (
  game.activeTool === "drawEdge" &&
  controlledNotesCount() === 1
) {
  _onDragLeftDrop(event);
} else {
  return wrapped(event);
}
    },
    "MIXED"
  );
  libWrapper.register(
    "investigator-pen",
    "NotesLayer.prototype._canDragLeftStart",
    (wrapped, user, event) => {
      if (game.activeTool === "drawEdge") return true;
      return wrapped(user, event);
    },
    "MIXED"
  );
  libWrapper.register(
    "investigator-pen",
    "NotesLayer.prototype._onDragLeftStart",
    (wrapped, event) => {
      if (game.activeTool === "drawEdge") {
        const spot = xyFromEvent(event);
        const note = canvas.notes.placeables
          .filter((t) => t.visible)
          .find((t) => isNoteInside(t, spot));
        if (!note) {
          wrapped(event);
          return;
        }
        InvestigatorPen.state.originNote = note;
        InvestigatorPen.state.pixiLine = new Line(note.center);
        InvestigatorPen.state.pixiLine.update(spot);
      } else {
        wrapped(event);
      }
    }, "MIXED"
  );
  libWrapper.register(
    "investigator-pen",
    "NotesLayer.prototype._onDragLeftMove",
    (wrapped, event) => {
      wrapped(event);
      if (game.activeTool === "drawEdge" && InvestigatorPen.state.pixiLine) {
        const spot = xyFromEvent(event);
        InvestigatorPen.state.pixiLine.update(spot);
      }
    }, "WRAPPER"
  );
  libWrapper.register(
    "investigator-pen",
    "NotesLayer.prototype._onDragLeftCancel",
    async (wrapped, event) => {
      wrapped(event);
      InvestigatorPen.state.pixiLine?.clear();
      InvestigatorPen.state.pixiLine = null;
    }, "WRAPPER"
  );
  libWrapper.register(
    "investigator-pen",
    "NotesLayer.prototype._onDragLeftDrop",
    async (wrapped, event) => {
      wrapped(event);
      if (game.activeTool === "drawEdge" && InvestigatorPen.state.pixiLine) {
        _onDragLeftDrop(event);
      }
    }, "WRAPPER"
  );
});

async function _onDragLeftDrop(event) {
  try {
    const spot = xyFromEvent(event);

    const target = canvas.notes.placeables
      .filter(n => n.visible)
      .find(n => isNoteInside(n, spot));

    if (target && target.id !== InvestigatorPen.state.originNote.id) {
      await InvestigatorPen.createEdge(
        InvestigatorPen.state.originNote.id,
        { to: target.id }
      );
    }
  } finally {
    InvestigatorPen.state.pixiLine?.clear();
    InvestigatorPen.state.pixiLine = null;
  }
}


// Trigger redrawing edges when a note moves:
Hooks.on("updateNote", (note, change) => {
  if (!game.user.isGM) return;
  if (["x", "y"].some((c) => c in change)) {
    const { x, y } = change;
    InvestigatorPen.updateEdgeDrawingsForNote(note, { x, y });
  }
});

Hooks.on("preDeleteNote", async (note) => {
  await InvestigatorPen.deleteAllEdgesToAndFrom(note);
});

// Handle destroying edge data when the linked drawing is deleted:
Hooks.on("preDeleteDrawing", async (drawing) => {
  await Promise.all(
    Object.entries(InvestigatorPen.allEdges)
      .filter(([key, edge]) => edge.drawingId === drawing.id)
      .map(([key, edge]) => InvestigatorPen.deleteEdge(key))
  );
});