'use client';

import { useEffect, useState } from 'react';
import { AssetPrice, getAvailableSymbols, fetchPrice } from '@/lib/market';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';

export default function MarketDashboard() {
  const [prices, setPrices] = useState<Record<string, AssetPrice>>({});
  const symbols = getAvailableSymbols();

  useEffect(() => {
    const updatePrices = async () => {
      const newPrices: Record<string, AssetPrice> = {};
      for (const symbol of symbols) {
        const data = await fetchPrice(symbol);
        newPrices[symbol] = data;
      }
      setPrices(newPrices);
    };

    updatePrices();
    const interval = setInterval(updatePrices, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Card className="border-zinc-200 dark:border-zinc-800">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Activity className="h-4 w-4 text-zinc-500" />
          Live Market Data
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[100px]">Asset</TableHead>
              <TableHead>Price</TableHead>
              <TableHead className="text-right">Change</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {symbols.map((symbol) => {
              const data = prices[symbol];
              if (!data) return null;
              const isPositive = data.change >= 0;

              return (
                <TableRow key={symbol} className="border-zinc-100 dark:border-zinc-900">
                  <TableCell className="font-bold">{symbol}</TableCell>
                  <TableCell className="font-mono">${data.price.toLocaleString()}</TableCell>
                  <TableCell className={`text-right font-medium flex items-center justify-end gap-1 ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                    {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {isPositive ? '+' : ''}{data.change}%
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
