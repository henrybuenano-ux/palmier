import { z } from 'zod';
import { state, snapshot, undo as undoState, nextClipShortId, nextMediaShortId, findOrCreateTrack } from './state.js';

function textResult(payload) {
  return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
}

function errorResult(message) {
  return { content: [{ type: 'text', text: message }], isError: true };
}

const clipEntrySchema = z.object({
  mediaRef: z.string().describe('Id of the media asset to place on the timeline'),
  trackIndex: z.number().int().describe('Track to place the clip on'),
  startFrame: z.number().int().describe('Frame at which the clip starts on the timeline'),
  durationFrames: z.number().int().describe('Duration of the clip in frames'),
  trimStartFrame: z.number().int().optional().describe('Trim offset into the source media'),
  trimEndFrame: z.number().int().optional().describe('Trim end offset into the source media')
});

export function registerTools(server) {
  server.registerTool(
    'getTimeline',
    {
      title: 'Get timeline',
      description: 'Returns project settings, track list, and all clips with their properties',
      inputSchema: {
        startFrame: z.number().int().optional().describe('Only return clips overlapping at or after this frame'),
        endFrame: z.number().int().optional().describe('Only return clips overlapping at or before this frame')
      }
    },
    async ({ startFrame, endFrame }) => {
      let clips = state.clips;
      if (startFrame !== undefined) clips = clips.filter(c => c.startFrame + c.durationFrames > startFrame);
      if (endFrame !== undefined) clips = clips.filter(c => c.startFrame < endFrame);
      return textResult({ project: state.project, tracks: state.tracks, clips });
    }
  );

  server.registerTool(
    'getMedia',
    {
      title: 'Get media',
      description: 'Retrieves all media assets in the library',
      inputSchema: {}
    },
    async () => textResult(state.media)
  );

  server.registerTool(
    'importMedia',
    {
      title: 'Import media',
      description: 'Imports a media asset (video, image, or audio) into the library',
      inputSchema: {
        name: z.string().describe('Display name for the asset'),
        type: z.enum(['video', 'image', 'audio']).describe('Kind of media asset'),
        durationFrames: z.number().int().optional().describe('Duration in frames (ignored for images)')
      }
    },
    async ({ name, type, durationFrames }) => {
      const media = {
        id: nextMediaShortId(),
        name,
        type,
        durationFrames: type === 'image' ? undefined : (durationFrames ?? state.project.fps * 5)
      };
      state.media.push(media);
      return textResult(media);
    }
  );

  server.registerTool(
    'addClips',
    {
      title: 'Add clips',
      description: 'Places media assets on the timeline as an undoable action',
      inputSchema: { entries: z.array(clipEntrySchema).describe('Clips to add') }
    },
    async ({ entries }) => {
      for (const entry of entries) {
        if (!state.media.some(m => m.id === entry.mediaRef)) {
          return errorResult(`No media with id ${entry.mediaRef}`);
        }
      }
      snapshot();
      const created = entries.map(entry => {
        findOrCreateTrack(entry.trackIndex);
        const clip = { id: nextClipShortId(), ...entry };
        state.clips.push(clip);
        return clip;
      });
      return textResult(created);
    }
  );

  server.registerTool(
    'removeClips',
    {
      title: 'Remove clips',
      description: 'Removes clips from the timeline by id',
      inputSchema: { clipIds: z.array(z.string()).describe('Ids of the clips to remove') }
    },
    async ({ clipIds }) => {
      snapshot();
      const before = state.clips.length;
      state.clips = state.clips.filter(c => !clipIds.includes(c.id));
      return textResult({ removed: before - state.clips.length });
    }
  );

  server.registerTool(
    'moveClips',
    {
      title: 'Move clips',
      description: 'Relocates clips to a new track and/or frame position',
      inputSchema: {
        moves: z
          .array(
            z.object({
              clipId: z.string(),
              toTrack: z.number().int(),
              toFrame: z.number().int()
            })
          )
          .describe('Clip relocations to apply')
      }
    },
    async ({ moves }) => {
      for (const move of moves) {
        if (!state.clips.some(c => c.id === move.clipId)) {
          return errorResult(`No clip with id ${move.clipId}`);
        }
      }
      snapshot();
      for (const move of moves) {
        const clip = state.clips.find(c => c.id === move.clipId);
        findOrCreateTrack(move.toTrack);
        clip.trackIndex = move.toTrack;
        clip.startFrame = move.toFrame;
      }
      return textResult(moves.map(m => state.clips.find(c => c.id === m.clipId)));
    }
  );

  server.registerTool(
    'splitClips',
    {
      title: 'Split clips',
      description: 'Cuts clips into two at the given frame(s) without shifting surrounding clips',
      inputSchema: {
        splits: z
          .array(z.object({ clipId: z.string(), atFrame: z.number().int() }))
          .optional()
          .describe('Explicit clip/frame pairs to split at'),
        trackIndex: z.number().int().optional().describe('Track to split clips on (used with frames)'),
        frames: z.array(z.number().int()).optional().describe('Frames to split at (used with trackIndex)')
      }
    },
    async ({ splits, trackIndex, frames }) => {
      const jobs = [];
      if (splits) {
        for (const s of splits) {
          const clip = state.clips.find(c => c.id === s.clipId);
          if (!clip) return errorResult(`No clip with id ${s.clipId}`);
          jobs.push({ clip, atFrame: s.atFrame });
        }
      } else if (trackIndex !== undefined && frames) {
        for (const atFrame of frames) {
          const clip = state.clips.find(
            c => c.trackIndex === trackIndex && c.startFrame < atFrame && c.startFrame + c.durationFrames > atFrame
          );
          if (clip) jobs.push({ clip, atFrame });
        }
      } else {
        return errorResult('Provide either "splits" or "trackIndex" + "frames"');
      }

      snapshot();
      const created = [];
      for (const { clip, atFrame } of jobs) {
        const offset = atFrame - clip.startFrame;
        if (offset <= 0 || offset >= clip.durationFrames) continue;
        const trimStart = clip.trimStartFrame ?? 0;
        const second = {
          ...clip,
          id: nextClipShortId(),
          startFrame: atFrame,
          durationFrames: clip.durationFrames - offset,
          trimStartFrame: trimStart + offset
        };
        clip.durationFrames = offset;
        state.clips.push(second);
        created.push(clip, second);
      }
      return textResult(created);
    }
  );

  server.registerTool(
    'removeTracks',
    {
      title: 'Remove tracks',
      description: 'Removes entire tracks along with all clips on them',
      inputSchema: { trackIndexes: z.array(z.number().int()).describe('Indexes of the tracks to remove') }
    },
    async ({ trackIndexes }) => {
      snapshot();
      state.tracks = state.tracks.filter(t => !trackIndexes.includes(t.index));
      state.clips = state.clips.filter(c => !trackIndexes.includes(c.trackIndex));
      return textResult({ tracks: state.tracks });
    }
  );

  server.registerTool(
    'setProjectSettings',
    {
      title: 'Set project settings',
      description: 'Changes frame rate, resolution, or aspect ratio for the project',
      inputSchema: {
        fps: z.number().optional(),
        width: z.number().int().optional(),
        height: z.number().int().optional(),
        aspectRatio: z.string().optional()
      }
    },
    async (updates) => {
      snapshot();
      Object.assign(state.project, Object.fromEntries(Object.entries(updates).filter(([, v]) => v !== undefined)));
      return textResult(state.project);
    }
  );

  server.registerTool(
    'undo',
    {
      title: 'Undo',
      description: 'Reverts the most recent timeline edit',
      inputSchema: {}
    },
    async () => {
      const reverted = undoState();
      return textResult({ reverted });
    }
  );
}
