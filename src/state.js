let nextClipId = 1;
let nextMediaId = 1;

function makeInitialState() {
  return {
    project: { fps: 30, width: 1920, height: 1080, aspectRatio: '16:9' },
    tracks: [
      { index: 0, type: 'video' },
      { index: 1, type: 'audio' }
    ],
    media: [],
    clips: []
  };
}

export const state = makeInitialState();

const undoStack = [];

export function snapshot() {
  undoStack.push(JSON.parse(JSON.stringify(state)));
}

export function undo() {
  const previous = undoStack.pop();
  if (!previous) return false;
  state.project = previous.project;
  state.tracks = previous.tracks;
  state.media = previous.media;
  state.clips = previous.clips;
  return true;
}

export function nextClipShortId() {
  return `c${nextClipId++}`;
}

export function nextMediaShortId() {
  return `m${nextMediaId++}`;
}

export function findOrCreateTrack(index, type = 'video') {
  let track = state.tracks.find(t => t.index === index);
  if (!track) {
    track = { index, type };
    state.tracks.push(track);
    state.tracks.sort((a, b) => a.index - b.index);
  }
  return track;
}
