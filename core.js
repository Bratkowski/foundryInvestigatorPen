import { getEdgeGivenTwoNodes } from "./canvas-utils.js";



export class InvestigatorPen  {
  static state = {
    originNote: null,
    pixiLine: null,
  };


  static onGetSceneControlButtons(buttons) {
    buttons.notes.tools.drawEdge = {
      name: "drawEdge",
      title: "Draw a connection",
      icon: "fas fa-chart-network",
    };
  }

  static get allEdges() {
    const allEdges = (canvas?.scene.notes || []).reduce(
      (accumulator, note) => {
        const noteEdges = this.getEdgesForNote(note.id);

        return {
          ...accumulator,
          ...noteEdges,
        };
      },
      {}
    );

    return allEdges;
  }

  static getEdgesForNote(noteId) {
    return (
      canvas?.scene.notes.get(noteId)?.getFlag("investigator-pen", "investigator-pen-edges") ||
      {}
    );
  }

static async createEdge(noteId, edgeData) {
  const id = foundry.utils.randomID(16);
  if (this.checkDuplicates(noteId, edgeData.to)) return;

  const newEdge = {
    ...edgeData,
    fromId: noteId
  };

  const newEdges = { [id]: newEdge };

  if (!game.user.isGM) {
    await game.socket.emit("module.investigator-pen", { id, newEdges, noteId });
    return;
  }

  const note = canvas.scene.notes.get(noteId);
  if (!note) return;

  const existing = this.getEdgesForNote(noteId);

  await note.setFlag(
    "investigator-pen",
    "investigator-pen-edges",
    { ...existing, ...newEdges }
  );

  await this.drawEdge(id);
}


  static checkDuplicates(a, b) {
    return Object.values(InvestigatorPen.allEdges).some((edge) => {
      return [a, b].includes(edge.to) && [a, b].includes(edge.fromId);
    });
  }

  static updateEdge(edgeId, updateData) {
    const relevantEdge = this.allEdges[edgeId];
    const update = {
      [edgeId]: updateData,
    };
    return canvas?.scene.notes
      .get(relevantEdge.fromId)
      ?.setFlag("investigator-pen", "investigator-pen-edges", update);
  }

  static deleteEdge(edgeId) {
    const relevantEdge = this.allEdges[edgeId];
    // Foundry specific syntax required to delete a key from a persisted object
    // in the database
    const keyDeletion = {
      [`-=${edgeId}`]: null,
    };
    return canvas?.scene.notes
      .get(relevantEdge.fromId)
      ?.setFlag("investigator-pen", "investigator-pen-edges", keyDeletion);
  }

  static deleteAllEdgesToAndFrom(note) {
    return Promise.all(
      Object.values(this.allEdges)
      .filter((edge) => edge.to === note.id || edge.fromId === note.id)
      .map((edge) => {
        const { drawingId } = edge;
        const drawing = canvas.scene.drawings.get(drawingId);
        return drawing?.delete();
      })
    );
  }

static async updateEdgeDrawingsForNote(note) {
  const noteId = note.id;

  const inbound = Object.values(this.allEdges)
    .filter(edge => edge.to === noteId)
    .map(edge => {
      const fromNode = canvas.scene.notes.get(edge.fromId)?._object?.center;
      const toNode   = canvas.scene.notes.get(noteId)?._object?.center;
      if (!fromNode || !toNode) return null;
      return {
        _id: edge.drawingId,
        ...getEdgeGivenTwoNodes(fromNode, toNode),
      };
    })
    .filter(Boolean);

  const outbound = Object.values(this.getEdgesForNote(noteId))
    .map(edge => {
      const fromNode = canvas.scene.notes.get(noteId)?._object?.center;
      const toNode   = canvas.scene.notes.get(edge.to)?._object?.center;
      if (!fromNode || !toNode) return null;
      return {
        _id: edge.drawingId,
        ...getEdgeGivenTwoNodes(fromNode, toNode),
      };
    })
    .filter(Boolean);

  if (!inbound.length && !outbound.length) return;

  return canvas.scene.updateEmbeddedDocuments("Drawing", [...inbound, ...outbound]);
}


  // This pertains to Drawings:
  static async drawEdge(edgeId) {
  const relevantEdge = this.allEdges[edgeId];
  if (!relevantEdge) return;

  const fromNode = canvas.scene.notes.get(relevantEdge.fromId)?._object?.center;
  const toNode   = canvas.scene.notes.get(relevantEdge.to)?._object?.center;

  if (!fromNode || !toNode) return;


    const edge = {
      ...getEdgeGivenTwoNodes(fromNode, toNode),
      strokeWidth: 5,
      strokeAlpha: 1,
      strokeColor: "#ff0000",
    };

    const [drawing] = await canvas.scene.createEmbeddedDocuments("Drawing", [
      edge,
    ]);


    if (game.modules.get('tokenmagic')?.active) {
      let params = [
        {
          filterType: "liquid",
          filterId: "yarnMantle",
          time: 0,
          blend: 5,
          spectral: false,
          scale: 7,
          animated: {
            time: {
              active: true,
              speed: 0.0000000015,
              animType: "move",
            },
            scale: {
              active: true,
              animType: "cosOscillation",
              loopDuration: 300,
              loops: 1,
              val1: 10,
              val2: 0.5,
            },
          },
        },
        {
          filterType: "shadow",
          filterId: "yarnShadow",
          rotation: 35,
          blur: 2,
          quality: 5,
          distance: 10,
          alpha: 0.7,
          padding: 10,
          shadowOnly: false,
          color: 0x000000,
          zOrder: 6000,
        },
      ];
      await TokenMagic.addFilters(drawing.object, params);
    }
    this.updateEdge(edgeId, { drawingId: drawing._id });
    return drawing;
  }
}