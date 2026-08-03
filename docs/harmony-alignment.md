# Harmony API data alignment

Reference project: **SV Harmony API** — a file-based JSON bridge for Synthesizer V
with a two-tool base API entry (`harmony_read`, `harmony_cmd`).

This document records how far the two projects' data structures already agree,
so a value produced by one can be read by the other without a translation table.

## Verdict

The **leaf level already aligns**: field names, time units, pitch encoding,
parameter names, and success/failure signalling are the same. No code change was
needed. Differences are confined to the **container level**, where the two
projects deliberately diverge: Harmony exports one whole-project snapshot, this
bridge answers bounded, paged queries against a live host.

## Layer by layer

| Layer | Harmony | SynthV Agent Bridge | Aligned |
|---|---|---|:--:|
| Time unit | blicks, 1 quarter note = 705,600,000 | same, plus derived `*Quarters` / `*Seconds` | Yes |
| Pitch | MIDI integer (60 = C4) | `pitch` MIDI integer, plus `absolutePitch` | Yes |
| Note fields | `onset`, `duration`, `pitch`, `lyrics`, `phonemes`, `musicalType`, `detune` | identical names and meanings, plus `noteIndex`, `fingerprint`, `endPosition`, `absolute*`, `attributes` | Yes |
| Parameter names | `pitchDelta`, `vibratoEnv`, `loudness`, `tension`, `breathiness`, `voicing`, `gender`, `toneShift` | same set, read straight from `automation:getType()` | Yes |
| Parameter points | flat interleaved `[blick, value, ...]` | object array `[{position, value}]` | Convertible |
| Interpolation | `mode` | `interpolation` | Key name differs |
| Container | whole project, `tracks[].mainGroup` | locator + paged query context | No, by design |
| Session | `Harmony_Session.json` array with four file paths | `BridgeStatus` (`state`, `updatedAtEpochMs`, `ipcDirectory`, `sessionToken`) | `state: "running"` only |
| Call envelope | `{id, lua}` → `{id, ok, result, error}` | `{protocolVersion, requestId, traceId, expectedExecutorBuildId, action, payload}` → `{..., ok, result\|error}` | `ok` flag only |

## Converting parameter points

```js
// Bridge object array -> Harmony flat array
const flat = points.flatMap((p) => [p.position, p.value]);

// Harmony flat array -> Bridge object array
const objects = [];
for (let i = 0; i < flat.length; i += 2) {
  objects.push({ position: flat[i], value: flat[i + 1] });
}
```

The conversion is lossless in both directions. Positions stay in blicks and
values keep their parameter-specific range.

## Why the container is not aligned

Harmony's snapshot model suits an external program that wants the whole project
at once and can tolerate a 1–15 s export tick. This bridge answers against the
live host under a response budget, returns a `contextId` whose guards must still
be fresh at write time, and keeps one logical command inside one SynthV Undo
boundary. Emitting a whole-project snapshot would break the response budget and
detach writes from the guards that make them safe.

An external tool that wants Harmony-shaped data can assemble it from
`list_tracks` + `list_note_groups` + `get_track_notes` + `get_automation`; the
leaf fields need no renaming.
