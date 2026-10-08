import { describe, expect, it } from 'vitest';
import { cleanPairingCode, isIPv4, printerIpProblem } from '../deviceChecks';

describe('printer IP checks', () => {
  const printers = [
    { id: 'p1', name: 'Cold / Pantry', ip: '10.1.20.12' },
    { id: 'p2', name: 'Hot Line', ip: '10.1.20.11' },
  ];

  it('accepts dotted IPv4 only', () => {
    expect(isIPv4('10.1.20.15')).toBe(true);
    expect(isIPv4('0.0.0.0')).toBe(true);
    for (const bad of ['999.1.1', 'abc.def', '10.1.20.', '10.1.20.256', '10.01.2.3', '1.2.3.4.5', '']) expect(isIPv4(bad), bad).toBe(false);
  });

  it('refuses blank, malformed and duplicate addresses, but a printer keeps its own', () => {
    expect(printerIpProblem(' ', printers)).toMatch(/Enter/);
    expect(printerIpProblem('999.1.1', printers)).toMatch(/isn’t an IP/);
    expect(printerIpProblem('10.1.20.12', printers)).toBe('Cold / Pantry already uses 10.1.20.12.');
    expect(printerIpProblem('10.1.20.12', printers, 'p1')).toBeNull();
    expect(printerIpProblem('10.1.20.15', printers)).toBeNull();
  });
});

describe('pairing codes', () => {
  it('takes six letters or digits, ignoring spaces and dashes', () => {
    expect(cleanPairingCode('ab3-k9z')).toBe('AB3K9Z');
    expect(cleanPairingCode('12345')).toBeNull();
    expect(cleanPairingCode('ABC 12!')).toBeNull();
  });
});
