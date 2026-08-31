import { useCallback, useState } from 'react';
import { requestDevice, sendTransaction, DeviceError } from '../gt65/device';

export type Status = 'idle' | 'connecting' | 'connected' | 'error';

export function useDevice(dryRun: boolean) {
  const [device, setDevice] = useState<HIDDevice | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [lastPackets, setLastPackets] = useState<Uint8Array[]>([]);

  const connect = useCallback(async () => {
    setStatus('connecting');
    setError(null);
    try {
      setDevice(await requestDevice());
      setStatus('connected');
    } catch (e) {
      setStatus('error');
      setError(e instanceof DeviceError ? e.message : String(e));
    }
  }, []);

  const send = useCallback(async (packets: Uint8Array[]) => {
    setLastPackets(packets);
    if (dryRun) return;
    if (!device) {
      setError('Belum tersambung ke keyboard.');
      return;
    }
    setError(null);
    try {
      await sendTransaction(device, packets);
    } catch (e) {
      setError(`Gagal mengirim: ${String(e)}`);
    }
  }, [device, dryRun]);

  return { device, status, error, connect, send, lastPackets };
}
