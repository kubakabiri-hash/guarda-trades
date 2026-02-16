'use client';

import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getAvailableSymbols, fetchPrice } from '@/lib/market';
import MarketDashboard from '@/components/MarketDashboard';
import { TradingViewChart, MarketTickerTape } from '@/components/TradingViewChart';
import { toast } from 'sonner';
import { LogOut, Plus, Users, Send, Wallet, Activity, TrendingUp, Trash2 } from 'lucide-react';

import { useRouter } from 'next/navigation';

export default function BrokerDashboard() {
  const { user, profile, signOut } = useAuth();
  const router = useRouter();
  const [traders, setTraders] = useState<any[]>([]);
  const [signals, setSignals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Signal Form State
  const [symbol, setSymbol] = useState('');
  const [type, setType] = useState<'buy' | 'sell'>('buy');
  const [quantity, setQuantity] = useState('1');
  const [logic, setLogic] = useState('');
  const [duration, setDuration] = useState('60'); // Minutes

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    // No setLoading(true) here to prevent flickering during auto-refresh
    
    // Fetch all real traders from database
    const { data: traderProfiles } = await supabase
      .from('profiles')
      .select('id, full_name, last_seen_at, role')
      .eq('role', 'trader');

    // Fetch all portfolios and attach to traders manually so balances always match
    const { data: portfolioData } = await supabase
      .from('portfolios')
      .select('user_id, balance, last_bonus_percent');

    const portfolioByUser: Record<string, any> = {};
    (portfolioData || []).forEach(p => {
      portfolioByUser[p.user_id] = p;
    });

    const mergedTraders = (traderProfiles || []).map(trader => ({
      ...trader,
      portfolios: portfolioByUser[trader.id] ? [portfolioByUser[trader.id]] : []
    }));

    setTraders(mergedTraders);
    
    // Fetch signals posted by this broker - explicitly select columns to avoid schema cache errors with 'expires_at'
    const { data: signalData } = await supabase
      .from('broker_signals')
      .select('id, created_at, broker_id, symbol, type, price, quantity, logic')
      .order('created_at', { ascending: false });

    setSignals(signalData || []);
    setLoading(false);
  };

  const [bonusPercents, setBonusPercents] = useState<Record<string, string>>({});

  const updateBalance = async (traderId: string, amount: string) => {
    const bonus = parseFloat(bonusPercents[traderId] || '0');
    const baseAmount = parseFloat(amount || '0');
    if (!baseAmount || isNaN(baseAmount)) {
      toast.error('Enter a valid amount');
      return;
    }

    const { data: existing } = await supabase
      .from('portfolios')
      .select('balance')
      .eq('user_id', traderId)
      .single();

    const currentBalance = existing?.balance ?? 0;
    const bonusAmount = (baseAmount * bonus) / 100;
    const totalAmount = currentBalance + baseAmount + bonusAmount;

    const { error } = await supabase
      .from('portfolios')
      .upsert({
        user_id: traderId,
        balance: totalAmount,
        last_bonus_percent: bonus,
        is_first_deposit: false
      }, { onConflict: 'user_id' });

    if (error) toast.error('Failed to update balance');
    else {
      toast.success(bonus > 0 
        ? `Allocated funds with ${bonus}% institutional bonus` 
        : 'Institutional funds allocated'
      );
      fetchData();
    }
  };

  const deleteTrader = async (traderId: string) => {
    if (!confirm('Are you sure you want to remove this trader and all their data?')) return;

    try {
      // Delete portfolio first (if not cascading)
      await supabase.from('portfolios').delete().eq('user_id', traderId);
      // Delete trades
      await supabase.from('trades').delete().eq('user_id', traderId);
      // Delete profile
      const { error } = await supabase.from('profiles').delete().eq('id', traderId);

      if (error) throw error;
      toast.success('Trader removed from terminal');
      fetchData();
    } catch (error: any) {
      toast.error('Failed to remove trader');
    }
  };

  const isOnline = (lastSeen: string | null) => {
    if (!lastSeen) return false;
    const lastSeenDate = new Date(lastSeen).getTime();
    const now = new Date().getTime();
    return (now - lastSeenDate) < 60000; // Online if seen in last 60 seconds
  };

  const handleDisconnect = async () => {
    await signOut();
    router.push('/');
  };

  const handleChartTrade = (symbol: string, type: 'buy' | 'sell') => {
    setSymbol(symbol);
    setType(type);
    toast.info(`Asset switched to ${symbol}. Ready to synchronize position.`);
    // Scroll to form for convenience
    const formElement = document.querySelector('form');
    formElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const deleteSignal = async (signalId: string) => {
    try {
      const { error } = await supabase
        .from('broker_signals')
        .delete()
        .eq('id', signalId);
      
      if (error) throw error;
      toast.success('Signal removed from history');
      fetchData();
    } catch (error: any) {
      toast.error('Failed to delete signal');
    }
  };

  const postSignal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!symbol) return toast.error('Select a symbol');

    try {
      const marketData = await fetchPrice(symbol);
      
      // Basic payload without the problematic column
      const payload: any = {
        broker_id: user?.id ?? null,
        symbol,
        type,
        price: marketData.price,
        quantity: parseFloat(quantity),
        logic
      };

      // First, try inserting WITHOUT expires_at to ensure it works
      const { error } = await supabase
        .from('broker_signals')
        .insert([payload]);

      if (error) throw error;

      toast.success('Market position synchronized');
      setLogic('');
      fetchData();
    } catch (error: any) {
      toast.error(`Execution failed: ${error.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans pb-12 selection:bg-indigo-500/30">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_var(--tw-gradient-stops))] from-indigo-950/20 via-transparent to-transparent pointer-events-none" />
      <MarketTickerTape />
      
      <div className="mx-auto max-w-7xl px-4 pt-8 space-y-8 relative z-10">
        <header className="flex items-center justify-between border-b border-white/5 pb-6">
          <div>
            <h1 className="text-4xl font-black tracking-tighter font-space-grotesk bg-clip-text text-transparent bg-gradient-to-r from-white to-white/50">BROKER MASTER CONSOLE</h1>
            <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mt-1 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
              INSTITUTIONAL AUTHORITY: <span className="text-indigo-400">{profile?.full_name?.toUpperCase()}</span>
            </p>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right hidden sm:block">
              <p className="text-[10px] text-zinc-600 uppercase font-black tracking-widest">GATEWAY STATUS</p>
              <div className="flex items-center gap-2 justify-end">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-tighter">Admin Session Active</span>
              </div>
            </div>
            <Button 
              variant="outline" 
              onClick={handleDisconnect} 
              className="gap-2 border-white/10 bg-white/5 hover:bg-white/10 text-white font-bold text-xs uppercase tracking-widest h-10 px-6 rounded-xl transition-all"
            >
              <LogOut className="h-3.5 w-3.5" /> DISCONNECT
            </Button>
          </div>
        </header>

        {/* Quick Stats */}
        <div className="grid gap-6 md:grid-cols-4">
          <Card className="bg-white/5 border-white/5 backdrop-blur-2xl shadow-2xl shadow-indigo-500/5 group hover:border-indigo-500/20 transition-all duration-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 group-hover:text-indigo-400 transition-colors">CONNECTED TRADERS</CardTitle>
              <Users className="h-4 w-4 text-indigo-500/50 group-hover:text-indigo-400 transition-colors" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black font-space-grotesk tracking-tighter">{traders.length}</div>
            </CardContent>
          </Card>
          <Card className="bg-white/5 border-white/5 backdrop-blur-2xl shadow-2xl shadow-indigo-500/5 group hover:border-indigo-500/20 transition-all duration-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 group-hover:text-indigo-400 transition-colors">ACTIVE SIGNALS</CardTitle>
              <Activity className="h-4 w-4 text-indigo-500/50 group-hover:text-indigo-400 transition-colors" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black font-space-grotesk tracking-tighter">{signals.length}</div>
            </CardContent>
          </Card>
          <Card className="bg-white/5 border-white/5 backdrop-blur-2xl shadow-2xl shadow-indigo-500/5 group hover:border-indigo-500/20 transition-all duration-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 group-hover:text-indigo-400 transition-colors">MARKET VOLATILITY</CardTitle>
              <TrendingUp className="h-4 w-4 text-indigo-500/50 group-hover:text-indigo-400 transition-colors" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black font-space-grotesk tracking-tighter text-emerald-400">HIGH</div>
            </CardContent>
          </Card>
          <Card className="bg-white/5 border-white/5 backdrop-blur-2xl shadow-2xl shadow-indigo-500/5 group hover:border-indigo-500/20 transition-all duration-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 group-hover:text-indigo-400 transition-colors">SYSTEM STATUS</CardTitle>
              <Activity className="h-4 w-4 text-indigo-500/50 group-hover:text-indigo-400 transition-colors" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black font-space-grotesk tracking-tighter text-indigo-400">SECURE</div>
            </CardContent>
          </Card>
        </div>

        {/* TradingView Chart */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold font-space-grotesk">Institutional Market Analysis</h2>
            <p className="text-xs text-zinc-500 uppercase tracking-widest">Real-time Terminal Data</p>
          </div>
          <TradingViewChart onTrade={handleChartTrade} />
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Post Signal Card */}
          <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-space-grotesk uppercase text-sm tracking-wider">
                <Send className="h-4 w-4" /> Synchronize Position
              </CardTitle>
              <CardDescription>Broadcast market entries to all connected traders.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={postSignal} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs uppercase font-bold text-zinc-500">Asset Selection</Label>
                    <Select onValueChange={setSymbol} value={symbol}>
                      <SelectTrigger className="font-bold">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {getAvailableSymbols().map(s => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs uppercase font-bold text-zinc-500">Execution Type</Label>
                    <Select onValueChange={(v: any) => setType(v)} value={type}>
                      <SelectTrigger className={`font-bold ${type === 'buy' ? 'text-green-500' : 'text-red-500'}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="buy">BUY (Long)</SelectItem>
                        <SelectItem value="sell">SELL (Short)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase font-bold text-zinc-500">Quantity Multiplier</Label>
                  <Input 
                    type="number" 
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="font-mono font-bold"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase font-bold text-zinc-500">Market Logic (Optional)</Label>
                  <Input 
                    placeholder="Technical breakout..." 
                    value={logic}
                    onChange={(e) => setLogic(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase font-bold text-zinc-500">Signal Validity (Minutes)</Label>
                  <Select onValueChange={setDuration} value={duration}>
                    <SelectTrigger className="font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5 Minutes</SelectItem>
                      <SelectItem value="15">15 Minutes</SelectItem>
                      <SelectItem value="30">30 Minutes</SelectItem>
                      <SelectItem value="60">1 Hour</SelectItem>
                      <SelectItem value="240">4 Hours</SelectItem>
                      <SelectItem value="1440">24 Hours</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full font-bold uppercase tracking-widest py-6">Execute Signal</Button>
              </form>
            </CardContent>
          </Card>

          {/* Trader Management */}
          <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 font-space-grotesk uppercase text-sm tracking-wider">
                  <Wallet className="h-4 w-4" /> Capital Allocation
                </CardTitle>
                <CardDescription>Traders start at $0. Allocate institutional funds below.</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={fetchData}><Activity className="h-4 w-4 mr-2" /> Refresh</Button>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border border-zinc-100 dark:border-zinc-900 overflow-hidden">
                <Table>
                  <TableHeader className="bg-zinc-50 dark:bg-zinc-900/50">
                    <TableRow>
                      <TableHead className="text-xs uppercase font-bold">Status</TableHead>
                      <TableHead className="text-xs uppercase font-bold">Trader Name</TableHead>
                      <TableHead className="text-xs uppercase font-bold">Equity Balance</TableHead>
                      <TableHead className="text-right text-xs uppercase font-bold">Funds Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {traders.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-zinc-500 italic">No traders currently connected to terminal.</TableCell>
                      </TableRow>
                    ) : (
                      traders.map(trader => {
                        const online = isOnline(trader.last_seen_at);
                        return (
                          <TableRow key={trader.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors">
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className={`h-2 w-2 rounded-full ${online ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-zinc-800'}`} />
                                <span className={`text-[10px] font-bold uppercase tracking-widest ${online ? 'text-emerald-500' : 'text-zinc-600'}`}>
                                  {online ? 'Online' : 'Offline'}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="font-bold">
                              <div className="flex flex-col">
                                <span>{trader.full_name || 'Anonymous'}</span>
                                <span className="text-[10px] text-zinc-500 font-mono">{trader.id.slice(0, 8)}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className={`font-mono font-bold ${(trader.portfolios?.[0]?.balance || 0) > 0 ? 'text-green-500' : 'text-zinc-500'}`}>
                                ${(trader.portfolios?.[0]?.balance || 0).toLocaleString()}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <div className="flex flex-col items-end gap-1.5">
                                  <div className="flex items-center gap-2">
                                    <div className="relative w-24">
                                      <span className="absolute left-2 top-1.5 text-zinc-400 text-xs">$</span>
                                      <Input 
                                        className="h-8 pl-5 font-mono text-xs" 
                                        type="number" 
                                        placeholder="Amount"
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            updateBalance(trader.id, e.currentTarget.value);
                                            e.currentTarget.value = '';
                                          }
                                        }}
                                      />
                                    </div>
                                    <Button 
                                      variant="outline" 
                                      size="sm"
                                      className="h-8 font-bold text-xs uppercase"
                                      onClick={(e) => {
                                        const input = e.currentTarget.previousElementSibling?.querySelector('input');
                                        if (input && input.value) {
                                          updateBalance(trader.id, input.value);
                                          input.value = '';
                                        }
                                      }}
                                    >
                                      Push
                                    </Button>
                                  </div>
                                  <div className="flex items-center gap-2 pr-1">
                                    <span className="text-[10px] font-black text-zinc-600 uppercase tracking-tighter">Bonus %</span>
                                    <Input 
                                      type="number" 
                                      placeholder="0" 
                                      value={bonusPercents[trader.id] || ''}
                                      onChange={(e) => setBonusPercents(prev => ({ ...prev, [trader.id]: e.target.value }))}
                                      className="w-12 h-5 text-[9px] font-bold bg-white/5 border-white/5 px-1 text-center"
                                    />
                                  </div>
                                </div>
                                {!online && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-zinc-500 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                                    onClick={() => deleteTrader(trader.id)}
                                    title="Delete offline trader"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
           {/* Signal History */}
           <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm lg:col-span-1">
            <CardHeader>
              <CardTitle className="font-space-grotesk uppercase text-sm tracking-wider">Broadcast History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {signals.length === 0 ? (
                  <p className="text-sm text-zinc-500 italic">No historical broadcasts.</p>
                ) : (
                  signals.slice(0, 8).map(sig => (
                    <div key={sig.id} className="group relative flex items-center justify-between rounded-lg border border-zinc-100 p-3 dark:border-zinc-900 bg-zinc-50/50 dark:bg-zinc-900/20">
                      <div>
                        <p className="font-bold text-sm uppercase">{sig.symbol}</p>
                        <p className="text-[10px] text-zinc-500">{new Date(sig.created_at).toLocaleTimeString()}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className={`text-xs font-bold ${sig.type === 'buy' ? 'text-green-500' : 'text-red-500'}`}>
                            {sig.type.toUpperCase()} @ ${sig.price}
                          </p>
                          {sig.expires_at && (
                            <p className="text-[8px] text-zinc-500 uppercase font-bold">
                              Exp: {new Date(sig.expires_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteSignal(sig.id)}
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-zinc-400 hover:text-rose-500 hover:bg-rose-500/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
          
          <div className="lg:col-span-2">
            <MarketDashboard />
          </div>
        </div>
      </div>
    </div>
  );
}