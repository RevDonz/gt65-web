export function formatHex(packets: Uint8Array[]): string {
  return packets
    .map((p, i) => {
      const rows: string[] = [];
      for (let o = 0; o < p.length; o += 16) {
        const bytes = [...p.subarray(o, o + 16)]
          .map((b) => b.toString(16).padStart(2, '0')).join(' ');
        rows.push(`  ${o.toString(16).padStart(2, '0')}: ${bytes}`);
      }
      return `paket ${i + 1}/${packets.length}\n${rows.join('\n')}`;
    })
    .join('\n\n');
}
