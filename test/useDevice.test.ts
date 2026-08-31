import { describe, expect, test } from 'vitest';
import { sendDecision } from '../src/app/useDevice';

const fakeDevice = {} as HIDDevice;

describe('sendDecision', () => {
  test('mode kering dengan perangkat tersambung tetap "dry"', () => {
    expect(sendDecision(true, fakeDevice)).toBe('dry');
  });

  test('mode kering tanpa perangkat tetap "dry"', () => {
    expect(sendDecision(true, null)).toBe('dry');
  });

  test('bukan mode kering tanpa perangkat menghasilkan "nodevice"', () => {
    expect(sendDecision(false, null)).toBe('nodevice');
  });

  test('bukan mode kering dengan perangkat menghasilkan "send"', () => {
    expect(sendDecision(false, fakeDevice)).toBe('send');
  });
});
