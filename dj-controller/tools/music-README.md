# MIXROOM original music

Run `python tools/music-generate.py` from any directory using Python 3 with NumPy installed. The script resolves the output paths from its own location, uses a fixed random seed, and regenerates `assets/*.wav`, `music-manifest.json`, and `tools/music-validation.json`.

The six instrumental compositions use synthesized drums, electric piano, sustained chord pads, bass, melodic motifs, transitions, and section-specific arrangements. No downloaded recordings or third-party samples are used. House and dance tracks have 64 bars; hip-hop tracks have 48 bars. All tracks are in 4/4, with a zero-second first beat and an exact bar-length duration rounded to the nearest sample. Phrase `bar` positions are zero-based.

Files are mono 16-bit PCM WAV at 22,050 Hz for reliable browser decoding without extra runtime dependencies. Peaks are normalized to 0.86 (about -1.3 dBFS), leaving headroom for mixing. The eight one-shot samples use the same synthesis building blocks. `SYNTH YEAH` is a formant-style oscillator sound, not a recorded voice.

The manifest contains `tracks` and `samples` arrays. Each track includes its relative asset URL, BPM, key, genre, duration, bar count, and named phrase boundaries. Browser decoding can resample these assets to the active audio context's rate; calculate duration and playback position using the decoded buffer's actual sample rate.
