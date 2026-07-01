# palmier

`palmier-pro` is an MCP server exposing an in-memory video editing timeline over HTTP
transport, mirroring the tool set of the [Palmier Pro](https://github.com/palmier-io/palmier-pro)
video editor's own MCP integration.

## Run

```sh
npm install
npm start
```

The server listens on `http://127.0.0.1:19789/mcp`.

## Register with Claude Code

```sh
claude mcp add --transport http palmier-pro http://127.0.0.1:19789/mcp
```

## Tools

- `getTimeline(startFrame?, endFrame?)` — project settings, tracks, and clips
- `getMedia()` — list media assets in the library
- `importMedia(name, type, durationFrames?)` — add a media asset
- `addClips(entries)` — place media assets on the timeline
- `removeClips(clipIds)` — remove clips by id
- `moveClips(moves)` — relocate clips to a new track/frame
- `splitClips(splits | trackIndex + frames)` — cut clips at given frames
- `removeTracks(trackIndexes)` — remove tracks and their clips
- `setProjectSettings(fps?, width?, height?, aspectRatio?)` — update project settings
- `undo()` — revert the most recent edit
