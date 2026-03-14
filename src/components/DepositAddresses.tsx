'use client';

import { Button } from '@/components/ui/button';
import { Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

const ADDRESSES = [
  { label: 'BTC', address: 'bc1q8vynh779s6qysu8p2g2zrdhvgzcfymp8qguvkp', color: 'text-amber-400' },
  { label: 'ETH', address: '0x0869cf5d27a436d8eDFF77BfEd98993f0777Fe37', color: 'text-indigo-400' },
  { label: 'USDT', address: 'TCCoYhazVnN85ZqjKP5waMExVEBbqtifok', color: 'text-emerald-400' },
  { label: 'SOL', address: '4dtS2wyg1gXbAjKCXPJJ2dUJqvtwAoLbJe6AiW4Yees2', color: 'text-purple-400' },
];

export function DepositAddresses() {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    toast.success(`${ADDRESSES[index].label} address copied to clipboard`);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="space-y-3">
      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Official Deposit Wallets</p>
      {ADDRESSES.map((item, index) => (
        <div key={item.label} className="space-y-1">
          <div className="flex items-center justify-between">
            <span className={`text-[10px] font-black uppercase tracking-widest ${item.color}`}>{item.label}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 text-zinc-500 hover:text-white hover:bg-white/10"
              onClick={() => copyToClipboard(item.address, index)}
            >
              {copiedIndex === index ? (
                <Check className="h-3 w-3 text-emerald-400" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </Button>
          </div>
          <div className="rounded-lg bg-white/[0.03] border border-white/5 p-2 font-mono text-[10px] break-all leading-relaxed text-zinc-400">
            {item.address}
          </div>
        </div>
      ))}
    </div>
  );
}
