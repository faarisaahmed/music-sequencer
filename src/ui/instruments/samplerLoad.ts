// Putting a sound into a Sampler track (shared by the Sampler editor and the FX panel).
import { DEFAULT_SAMPLER, type Track } from '../../model/types';
import { updateTrack } from '../../state/actions';
import { toast } from '../../state/store';
import { noteName } from '../../model/music';
import { detectPitch, detectSlices } from '../../audio/sampleTools';
import { addToSampleLibrary } from '../../audio/sampleLibrary';

/** Load a sound: trimmed to the whole sound, root found if it's pitched, and saved to My Samples. */
export function loadSound(track: Track, id: string, buf: AudioBuffer, name: string): void {
  const root = detectPitch(buf);
  updateTrack(track.id, (t) => {
    t.samplerAudioId = id;
    t.samplerRoot = root ?? t.samplerRoot ?? 60;
    const mode = t.sampler?.mode ?? 'classic';
    t.sampler = { ...DEFAULT_SAMPLER, mode, slices: mode === 'slice' ? detectSlices(buf, 0, buf.duration, 16) : undefined };
  });
  void addToSampleLibrary(id, name, buf.duration);
  toast(root !== null ? `Loaded ${name} — its pitch is ${noteName(root)}, so it plays in tune` : `Loaded ${name} — play it on the keyboard`, 'success');
}
