import { beforeEach, expect, test } from 'vitest';
import { defaultProfile, parseProfile, saveProfile, promoteProvenance } from '../src/store/profile';
import { loadLibrary, parseLibrary, LIBRARY_KEY } from '../src/store/library';
import { settings, encodeEntry } from '../src/gt65/protocol';
import { defaultColors, perKeyLighting, parseColors } from '../src/gt65/perKey';
import { macroBytes, macroImage, macroPreview, parseMacros } from '../src/gt65/macros';
import type { Macro } from '../src/gt65/macros';

beforeEach(() => localStorage.clear());
test('imports legacy active profile into library without dropping data or provenance', () => {
  const p = { ...defaultProfile(), name: 'Travail', provenance: 'imported' as const, backedUp: true };
  saveProfile(p);
  const { library, error } = loadLibrary();
  expect(error).toBeNull(); expect(library.items[0].profile).toEqual(p);
  expect(library.activeId).toBe(library.items[0].id);
});
test('rejects duplicate IDs and missing active IDs; retains corrupted source', () => {
  const { library } = loadLibrary();
  expect(() => parseLibrary({ ...library, items: [...library.items, library.items[0]] })).toThrow();
  expect(() => parseLibrary({ ...library, activeId: 'missing' })).toThrow();
  localStorage.setItem(LIBRARY_KEY, 'broken');
  expect(loadLibrary().error).not.toBeNull();
  expect(localStorage.getItem(LIBRARY_KEY)).toBe('broken');
});
test('game mode gates only the three blocking flags, retaining Fn and timeout', () => {
  expect([...settings({ flags: [false, true, true, true, true], sleepTimeout: 30 })[2].slice(0, 7)]).toEqual([0, 0, 0, 0, 0, 1, 30]);
  expect([...settings({ flags: [true, true, true, true, false], sleepTimeout: 5 })[2].slice(0, 7)]).toEqual([0, 1, 1, 1, 1, 0, 5]);
});
test('16-bit consumer usages survive profile import and encode both bytes', () => {
  const p = defaultProfile(); p.layers.top[1] = { kind: 'consumer', usage: 0x224 };
  expect(parseProfile(p).layers.top[1]).toEqual(p.layers.top[1]);
  expect(encodeEntry(p.layers.top[1])).toEqual([3, 0x24, 2, 0]);
  p.layers.top[1] = { kind: 'consumer', usage: 65536 };
  expect(() => parseProfile(p)).toThrow();
});
test('per-key RGB uses indexed 576-byte table and separate custom activation', () => {
  const colors = defaultColors(); colors[119] = [23, 45, 67];
  const [upload, activate] = perKeyLighting(colors);
  expect(upload).toHaveLength(13); expect(upload[1][1]).toBe(0x23); expect(upload[1][8]).toBe(9);
  const table = Uint8Array.from(upload.slice(2, 11).flatMap((p) => [...p]));
  expect([...table.slice(119 * 4, 120 * 4)]).toEqual([119, 23, 45, 67]);
  expect([...table.slice(-2)]).toEqual([0xaa, 0x55]);
  expect([...activate[2].slice(0, 16)]).toEqual([128,0,0,0,0,0,0,0,0,15,15,0,0,0,170,85]);
  expect(() => parseColors([[0, 0, 0]])).toThrow();
  colors[2][1] = 256; expect(() => perKeyLighting(colors)).toThrow();
});
test('macro image directory, header, key, delay and mouse events follow vendor offsets', () => {
  const macros: Macro[] = [{ slot: 2, name: 'A', events: [{ kind: 'key', value: 4, down: true }, { kind: 'delay', ms: 300 }, { kind: 'key', value: 4, down: false }, { kind: 'mouse', value: 2, down: true }] }];
  const image = macroImage(macros);
  expect(image.length).toBe(3584); expect([...image.slice(0, 8)]).toEqual(Array(8).fill(255));
  expect([...image.slice(8, 12)]).toEqual([0x90, 1, 0, 0]);
  expect([...image.slice(400, 408)]).toEqual([4, 0, 0, 0, 0, 0, 0, 0]);
  expect([...image.slice(408, 424)]).toEqual([0,0,4,0xb0, 0x2c,1,0,0x50, 0,0,4,0x30, 0,0,2,0x90]);
  expect(macroBytes(macros)).toBe(424);
  const packets = macroPreview(macros); expect(packets[0][1]).toBe(0x19); expect(packets[1][8]).toBe(56); expect(packets.at(-1)![1]).toBe(2);
});
test('macro capacity accounts for headers and rejects invalid events and duplicate slots', () => {
  const m: Macro = { slot: 0, name: 'Capacity', events: Array.from({ length: 794 }, () => ({ kind: 'delay', ms: 10 })) };
  expect(macroBytes(parseMacros([m]))).toBe(3584);
  expect(() => parseMacros([{ ...m, events: [...m.events, { kind: 'delay', ms: 1 }] }])).toThrow();
  expect(() => parseMacros([{ ...m, events: [{ kind: 'delay', ms: NaN }] }])).toThrow();
  expect(() => parseMacros([{ ...m, events: [] }, { ...m, events: [] }])).toThrow();
});
test('optional RGB and macro data round-trip with profile and count as edits', () => {
  const base = defaultProfile();
  const next = { ...base, perKeyColors: defaultColors(), macros: [{ slot: 0, name: 'Hello', events: [] }] };
  expect(parseProfile(JSON.parse(JSON.stringify(next)))).toEqual(next);
  expect(promoteProvenance(base, next).provenance).toBe('edited');
  expect(parseProfile(base)).toEqual(base);
});
