'use client';

import { Button } from '@/components/ui/button';
import { Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

const ADDRESSES = [
  { label: 'BTC', address: 'bc1qqsyr0xew3t2qpylvmxgx8ggd4yrwtx2mnhe7rs', color: 'text-amber-400' },
  { label: 'ETH', address: '0x431712ae68b384830B7Cd5AfaD804a98e367F0c5', color: 'text-indigo-400' },
  { label: 'USDT', address: 'TNS7XmP3fqm2FH1tP7kKrf6z6i3TJ4UsiL', color: 'text-emerald-400' },
  { label: 'SOL', address: '8ysRjkojfZxm1CCijYLao9MHH2c4vf7XuWgmtvg5Kb4Q', color: 'text-purple-400' },
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
