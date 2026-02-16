'use client';

import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { fetchPrice } from '@/lib/market';
import { TradingViewChart, MarketTickerTape } from '@/components/TradingViewChart';
import { toast } from 'sonner';
import { Wallet, Activity, TrendingUp, Settings, Bell, Users, ArrowDownToLine, ArrowUpFromLine, LogOut, X, ChevronRight } from 'lucide-react';
import { DepositAddresses } from '@/components/DepositAddresses';
import { useRouter } from 'next/navigation';

export default function TraderDashboard() {
  const { user, profile, signOut } = useAuth();
  const router = useRouter();
  const [portfolio, setPortfolio] = useState<any>(null);
  const [signals, setSignals] = useState<any[]>([]);
  const [trades, setTrades] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissedSignals, setDismissedSignals] = useState<Set<string>>(new Set());
  const [marketPrices, setMarketPrices] = useState<Record<string, number>>({});
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPanel, setMenuPanel] = useState<string | null>(null);
  const [showBonusBanner, setShowBonusBanner] = useState(false);
  const [lastSeenBonus, setLastSeenBonus] = useState<number | null>(null);

  // Load last seen bonus from localStorage so old bonuses don't show again
  useEffect(() => {
    if (!user || typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(`bonus_seen_${user.id}`);
    if (stored) {
      const parsed = parseFloat(stored);
      if (!isNaN(parsed)) setLastSeenBonus(parsed);
    }
  }, [user]);

  // Show banner only when a new bonus percent is applied
  useEffect(() => {
    if (!user) return;
    const bonus = portfolio?.last_bonus_percent;
    if (!bonus || bonus <= 0) return;
    if (lastSeenBonus !== null && bonus === lastSeenBonus) return;

    setShowBonusBanner(true);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(`bonus_seen_${user.id}`, bonus.toString());
    }

    const timeout = setTimeout(() => setShowBonusBanner(false), 5000);
    return () => clearTimeout(timeout);
  }, [user, portfolio?.last_bonus_percent, lastSeenBonus]);

  useEffect(() => {
    if (!user) return;
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [user]);

  // Heartbeat to track online status
  useEffect(() => {
    if (!user) return;
    
    const updateHeartbeat = async () => {
      await supabase
        .from('profiles')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('id', user.id);
    };

    updateHeartbeat();
    const interval = setInterval(updateHeartbeat, 30000); // Every 30s
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    if (trades.length === 0) return;
    const interval = setInterval(async () => {
      const symbols = Array.from(new Set(trades.map(t => t.symbol)));
      const newPrices: Record<string, number> = { ...marketPrices };
      for (const sym of symbols) {
        try {
          const data = await fetchPrice(sym);
          newPrices[sym] = data.price;
        } catch (e) { /* skip */ }
      }
      setMarketPrices(newPrices);
    }, 5000);
    return () => clearInterval(interval);
  }, [trades, marketPrices]);

  // Handle automatic signal dismissal after 15 minutes OR broker-defined expiry
  useEffect(() => {
    if (signals.length === 0) return;
    
    const checkExpirations = () => {
      const now = new Date().getTime();
      const fifteenMinutes = 15 * 60 * 1000;
      const newlyExpired = signals
        .filter(sig => {
          if (dismissedSignals.has(sig.id)) return false;
          
          // Check broker-defined expiry first
          if (sig.expires_at) {
            return new Date(sig.expires_at).getTime() < now;
          }
          
          // Fallback to default 15m expiration
          const createdAt = new Date(sig.created_at).getTime();
          return (now - createdAt) > fifteenMinutes;
        })
        .map(sig => sig.id);

      if (newlyExpired.length > 0) {
        setDismissedSignals(prev => {
          const next = new Set(prev);
          newlyExpired.forEach(id => next.add(id));
          return next;
        });
      }
    };

    checkExpirations();
    const interval = setInterval(checkExpirations, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, [signals, dismissedSignals]);

  const fetchData = async () => {
    setLoading(true);
    
    // Fetch real-time portfolio data from broker (Supabase)
    const { data: supabaseData } = await supabase.from('portfolios').select('*').eq('user_id', user?.id).single();
    let portData = supabaseData;
    
    // Prefer DB record; only use local fallback when portfolio doesn't exist yet
    if (!portData && typeof window !== 'undefined') {
      const savedBalance = localStorage.getItem('mukulu_balance');
      const savedBonus = localStorage.getItem('mukulu_bonus');
      if (savedBalance !== null || savedBonus !== null) {
        portData = {
          user_id: user?.id,
          balance: savedBalance ? parseFloat(savedBalance) : 0,
          last_bonus_percent: savedBonus ? parseFloat(savedBonus) : 0
        };
      }
    }

    const { data: signalData } = await supabase
      .from('broker_signals')
      .select('id, created_at, broker_id, symbol, type, price, quantity, logic')
      .order('created_at', { ascending: false });
    const { data: tradeData } = await supabase.from('trades').select('*').eq('user_id', user?.id).eq('status', 'open').order('created_at', { ascending: false });
    
    setPortfolio(portData);
    setSignals(signalData || []);
    setTrades(tradeData || []);
    if (tradeData && tradeData.length > 0) {
      const symbols = Array.from(new Set(tradeData.map(t => t.symbol)));
      const initialPrices: Record<string, number> = {};
      for (const sym of symbols) {
        const data = await fetchPrice(sym);
        initialPrices[sym] = data.price;
      }
      setMarketPrices(initialPrices);
    }
    setLoading(false);
  };

  const dismissSignal = (id: string) => {
    setDismissedSignals(prev => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    toast.info('Signal removed from dashboard');
  };

  const calculateTotalPL = () => {
    return trades.reduce((total, trade) => {
      const currentPrice = marketPrices[trade.symbol] || trade.price_at_trade;
      const pl = trade.type === 'buy'
        ? (currentPrice - trade.price_at_trade) * trade.quantity
        : (trade.price_at_trade - currentPrice) * trade.quantity;
      return total + pl;
    }, 0);
  };

  const executeTrade = async (symbol: string, type: 'buy' | 'sell') => {
    if (!portfolio || portfolio.balance <= 0) {
      return toast.error('Insufficient balance. Contact your Broker for funding.');
    }
    try {
      const marketData = await fetchPrice(symbol);
      const priceAtTrade = marketData.price;
      const quantity = Math.max(1, Math.floor((portfolio.balance * 0.1) / priceAtTrade));
      if (quantity <= 0) throw new Error('Balance too low to open position.');

      const { error } = await supabase.from('trades').insert([{
        user_id: user?.id, symbol, type, price_at_trade: priceAtTrade, quantity, is_cloned: false
      }]);
      if (error) throw error;

      const cost = quantity * priceAtTrade;
      await supabase.from('portfolios').update({ balance: portfolio.balance - cost }).eq('user_id', user?.id);
      toast.success(`${type.toUpperCase()} ${symbol} x${quantity} @ $${priceAtTrade.toLocaleString()}`);
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const followTrade = async (signal: any) => {
    if (!portfolio || portfolio.balance <= 0) {
      return toast.error('Insufficient balance. Contact your Broker.');
    }
    try {
      const marketData = await fetchPrice(signal.symbol);
      const priceAtTrade = marketData.price;
      let targetQuantity = signal.quantity;
      const totalCost = targetQuantity * priceAtTrade;
      if (totalCost > portfolio.balance) {
        targetQuantity = Math.floor((portfolio.balance * 0.9) / priceAtTrade);
        if (targetQuantity <= 0) throw new Error('Balance too low to execute.');
        toast.info(`Adjusted quantity to ${targetQuantity} due to balance limits.`);
      }
      const { error } = await supabase.from('trades').insert([{
        user_id: user?.id, symbol: signal.symbol, type: signal.type,
        price_at_trade: priceAtTrade, quantity: targetQuantity, is_cloned: true, signal_id: signal.id
      }]);
      if (error) throw error;
      const newBalance = portfolio.balance - (targetQuantity * priceAtTrade);
      await supabase.from('portfolios').update({ balance: newBalance }).eq('user_id', user?.id);
      toast.success(`Copied ${signal.symbol} trade!`);
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const closeTrade = async (trade: any) => {
    try {
      const marketData = await fetchPrice(trade.symbol);
      const exitPrice = marketData.price;
      const pl = trade.type === 'buy'
        ? (exitPrice - trade.price_at_trade) * trade.quantity
        : (trade.price_at_trade - exitPrice) * trade.quantity;
      await supabase.from('trades').update({ status: 'closed' }).eq('id', trade.id);
      const returnAmount = (trade.quantity * trade.price_at_trade) + pl;
      await supabase.from('portfolios').update({ balance: portfolio.balance + returnAmount }).eq('user_id', user?.id);
      toast.success(`Closed. P/L: ${pl >= 0 ? '+' : ''}${pl.toFixed(2)} USDT`);
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDisconnect = async () => {
    await signOut();
    router.push('/');
  };

  const menuItems = [
    { id: 'deposit', label: 'Deposit', icon: ArrowDownToLine, color: 'text-emerald-400' },
    { id: 'withdraw', label: 'Withdraw', icon: ArrowUpFromLine, color: 'text-amber-400' },
    { id: 'notifications', label: 'Notifications', icon: Bell, color: 'text-indigo-400' },
    { id: 'community', label: 'Community', icon: Users, color: 'text-cyan-400' },
  ];

  const totalPL = calculateTotalPL();

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-indigo-500/30">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-indigo-950/20 via-transparent to-transparent pointer-events-none" />
      <MarketTickerTape />

      <div className="mx-auto max-w-7xl px-4 pt-6 pb-12 space-y-6 relative z-10">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-white/5 pb-5">
          <div>
            <h1 className="text-3xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-white to-white/50">TRADER TERMINAL</h1>
            <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mt-1 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)] animate-pulse" />
              {profile?.full_name || 'TRADER'}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => { setMenuOpen(true); setMenuPanel(null); }}
            className="h-10 w-10 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-all"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </header>

        {/* Bonus Message */}
        {portfolio?.last_bonus_percent > 0 && showBonusBanner && (
          <div className="rounded-2xl border border-indigo-500/30 bg-indigo-500/10 p-4 relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-transparent animate-pulse" />
            <button
              onClick={() => setShowBonusBanner(false)}
              className="absolute right-3 top-3 z-10 p-1.5 rounded-lg bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 transition-all"
              title="Dismiss bonus message"
            >
              <X className="h-3 w-3" />
            </button>
            <div className="flex items-center gap-4 relative z-10">
              <div className="h-10 w-10 rounded-xl bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30">
                <TrendingUp className="h-5 w-5 text-indigo-400" />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-white">Institutional Bonus Applied</h3>
                <p className="text-xs text-indigo-300/80 font-medium">
                  You've received a <span className="text-white font-bold">{portfolio.last_bonus_percent}% bonus</span> on your initial deposit. 
                  Trading capital has been successfully synchronized by your broker.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Stats row */}
        <div className="grid gap-4 grid-cols-3">
          <div className="rounded-2xl border border-white/5 bg-white/[0.03] backdrop-blur-xl p-4 group hover:border-indigo-500/20 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">LIQUIDITY</span>
              <Wallet className="h-3.5 w-3.5 text-indigo-500/50" />
            </div>
            <div className="text-2xl font-black tracking-tighter text-emerald-400">
              {portfolio?.balance?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
              <span className="text-sm text-emerald-500/70 ml-1">USDT</span>
            </div>
          </div>
          <div className="rounded-2xl border border-white/5 bg-white/[0.03] backdrop-blur-xl p-4 group hover:border-indigo-500/20 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">POSITIONS</span>
              <Activity className="h-3.5 w-3.5 text-indigo-500/50" />
            </div>
            <div className="text-2xl font-black tracking-tighter">{trades.length}</div>
          </div>
          <div className="rounded-2xl border border-white/5 bg-white/[0.03] backdrop-blur-xl p-4 group hover:border-indigo-500/20 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">P/L</span>
              <TrendingUp className="h-3.5 w-3.5 text-indigo-500/50" />
            </div>
            <div className={`text-2xl font-black tracking-tighter ${totalPL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {totalPL >= 0 ? '+' : ''}{totalPL.toFixed(2)}
              <span className={`text-sm ml-1 ${totalPL >= 0 ? 'text-emerald-500/70' : 'text-rose-500/70'}`}>USDT</span>
            </div>
          </div>
        </div>

        {/* Chart with trade execution */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Market Analysis</h2>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Live Feed</span>
            </div>
          </div>
          <TradingViewChart onTrade={executeTrade} />
        </div>

        {/* Signals + Positions */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Broker Signals</h2>
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 bg-white/5 px-3 py-1 rounded-lg">{signals.length} active</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {signals.filter(sig => !dismissedSignals.has(sig.id)).length === 0 ? (
                <div className="col-span-2 py-16 text-center border border-dashed border-white/5 rounded-2xl bg-white/[0.02]">
                  <Activity className="h-6 w-6 mx-auto mb-3 text-zinc-800 animate-pulse" />
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Waiting for broker signals...</p>
                </div>
              ) : (
                signals
                  .filter(sig => !dismissedSignals.has(sig.id))
                  .map(sig => (
                    <Card key={sig.id} className="relative overflow-hidden border-white/5 bg-[#0a0a0a] group hover:border-indigo-500/20 transition-all">
                      <div className={`absolute left-0 top-0 h-full w-0.5 ${sig.type === 'buy' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                      
                      {/* Dismiss button */}
                      <button 
                        onClick={() => dismissSignal(sig.id)}
                        className="absolute right-2 top-2 z-10 p-1.5 rounded-lg bg-white/5 text-zinc-500 hover:text-white hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-all"
                        title="Remove Signal"
                      >
                        <X className="h-3 w-3" />
                      </button>

                      <CardHeader className="pb-2 pt-4 px-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-lg font-black tracking-tight">{sig.symbol}</CardTitle>
                          <CardDescription className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">
                            {sig.profiles?.full_name?.toUpperCase() || 'BROKER'}
                          </CardDescription>
                        </div>
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-widest ${
                          sig.type === 'buy' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                        }`}>
                          {sig.type}
                        </span>
                      </div>
                      {sig.expires_at && (
                        <div className="mt-1 flex items-center gap-1.5">
                          <Activity className="h-2.5 w-2.5 text-indigo-500/50" />
                          <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-tighter">
                            Valid until {new Date(sig.expires_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-3 px-4 pb-4">
                      <div className="flex justify-between text-xs">
                        <span className="text-zinc-500 text-[10px] uppercase tracking-widest font-bold">Entry</span>
                        <span className="font-mono font-bold">${sig.price.toLocaleString()}</span>
                      </div>
                      {sig.logic && (
                        <p className="text-[10px] italic text-zinc-500 bg-white/[0.02] p-2.5 rounded-lg border border-white/5 leading-relaxed">
                          &ldquo;{sig.logic}&rdquo;
                        </p>
                      )}
                      <button
                        onClick={() => followTrade(sig)}
                        className={`w-full py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all text-white ${
                          sig.type === 'buy'
                            ? 'bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-500/10'
                            : 'bg-rose-600 hover:bg-rose-500 shadow-lg shadow-rose-500/10'
                        }`}
                      >
                        COPY TRADE
                      </button>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>

          {/* Positions sidebar */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold">Open Positions</h2>
            <div className="space-y-3">
              {trades.length === 0 ? (
                <div className="py-12 text-center border border-dashed border-white/5 rounded-2xl bg-white/[0.02]">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">No open positions</p>
                </div>
              ) : (
                trades.map(trade => {
                  const currentPrice = marketPrices[trade.symbol] || trade.price_at_trade;
                  const pl = trade.type === 'buy'
                    ? (currentPrice - trade.price_at_trade) * trade.quantity
                    : (trade.price_at_trade - currentPrice) * trade.quantity;
                  return (
                    <div key={trade.id} className="rounded-xl border border-white/5 bg-[#0a0a0a] p-3 space-y-2">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span className={`h-1.5 w-1.5 rounded-full ${trade.type === 'buy' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                          <span className="font-bold text-sm">{trade.symbol}</span>
                        </div>
                        <span className={`text-xs font-mono font-bold ${pl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {pl >= 0 ? '+' : ''}{pl.toFixed(2)} USDT
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-zinc-500 font-mono">
                          {trade.type.toUpperCase()} x{trade.quantity} @ ${trade.price_at_trade}
                        </span>
                        <button
                          onClick={() => closeTrade(trade)}
                          className="text-[10px] font-black uppercase tracking-widest text-rose-400 hover:text-rose-300 transition-colors"
                        >
                          Close
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Settings menu overlay */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setMenuOpen(false); setMenuPanel(null); }} />
          <div className="relative w-full max-w-sm bg-[#0a0a0a] border-l border-white/5 h-full flex flex-col animate-in slide-in-from-right duration-300">
            {/* Menu header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
              <h3 className="text-sm font-black uppercase tracking-widest">
                {menuPanel ? menuPanel : 'Settings'}
              </h3>
              <button
                onClick={() => { if (menuPanel) setMenuPanel(null); else { setMenuOpen(false); setMenuPanel(null); } }}
                className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-white/5 text-zinc-400 hover:text-white transition-all"
              >
                {menuPanel ? <ChevronRight className="h-4 w-4 rotate-180" /> : <X className="h-4 w-4" />}
              </button>
            </div>

            {/* Menu content */}
            <div className="flex-1 overflow-y-auto">
              {!menuPanel && (
                <div className="p-4 space-y-1">
                  {/* User info */}
                  <div className="px-4 py-4 mb-3 rounded-xl bg-white/[0.03] border border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-black text-sm">
                        {profile?.full_name?.charAt(0)?.toUpperCase() || 'T'}
                      </div>
                      <div>
                        <p className="font-bold text-sm">{profile?.full_name || 'Trader'}</p>
                        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Active Session</p>
                      </div>
                    </div>
                  </div>

                  {menuItems.map(item => (
                    <button
                      key={item.id}
                      onClick={() => setMenuPanel(item.id)}
                      className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl hover:bg-white/5 transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <item.icon className={`h-4 w-4 ${item.color}`} />
                        <span className="text-sm font-bold">{item.label}</span>
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
                    </button>
                  ))}
                </div>
              )}

              {/* Deposit panel */}
              {menuPanel === 'deposit' && (
                <div className="p-5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-4">Fund your account via crypto transfer</p>
                  <DepositAddresses />
                </div>
              )}

              {/* Withdraw panel */}
              {menuPanel === 'withdraw' && (
                <div className="p-5 space-y-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Request a withdrawal</p>
                  <div className="rounded-xl bg-white/[0.03] border border-white/5 p-4 space-y-3">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-1.5">Amount (USDT)</label>
                      <input
                        type="number"
                        placeholder="0.00"
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm font-mono text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-1.5">Wallet Address</label>
                      <input
                        type="text"
                        placeholder="Enter your wallet address"
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm font-mono text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block mb-1.5">Network</label>
                      <select className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/50">
                        <option value="trc20">TRC20 (USDT)</option>
                        <option value="erc20">ERC20 (ETH)</option>
                        <option value="bep20">BEP20 (BSC)</option>
                        <option value="sol">Solana</option>
                      </select>
                    </div>
                    <button
                      onClick={() => toast.success('Withdrawal request submitted. Your broker will review it.')}
                      className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-black uppercase tracking-widest transition-all"
                    >
                      Submit Withdrawal
                    </button>
                  </div>
                  <p className="text-[10px] text-zinc-600 text-center">Withdrawals are processed within 24 hours by your broker.</p>
                </div>
              )}

              {/* Notifications panel */}
              {menuPanel === 'notifications' && (
                <div className="p-5 space-y-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Recent activity</p>
                  {trades.length > 0 ? trades.slice(0, 5).map(trade => (
                    <div key={trade.id} className="flex items-center gap-3 px-3 py-3 rounded-xl bg-white/[0.02] border border-white/5">
                      <div className={`h-2 w-2 rounded-full ${trade.type === 'buy' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                      <div className="flex-1">
                        <p className="text-xs font-bold">{trade.type.toUpperCase()} {trade.symbol}</p>
                        <p className="text-[10px] text-zinc-500">x{trade.quantity} @ ${trade.price_at_trade}</p>
                      </div>
                    </div>
                  )) : (
                    <div className="py-10 text-center">
                      <Bell className="h-6 w-6 mx-auto mb-2 text-zinc-700" />
                      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">No notifications yet</p>
                    </div>
                  )}
                </div>
              )}

              {/* Community panel */}
              {menuPanel === 'community' && (
                <div className="p-5 space-y-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Trading Community</p>
                  <div className="rounded-xl bg-white/[0.03] border border-white/5 p-4 text-center space-y-3">
                    <Users className="h-8 w-8 mx-auto text-cyan-400/50" />
                    <p className="text-sm font-bold">Join the Discussion</p>
                    <p className="text-[10px] text-zinc-500 leading-relaxed">Connect with other traders, share strategies, and learn from the community.</p>
                    <button
                      onClick={() => toast.info('Community features coming soon.')}
                      className="w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-[10px] font-black uppercase tracking-widest transition-all"
                    >
                      Open Community
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Disconnect at bottom */}
            {!menuPanel && (
              <div className="p-4 border-t border-white/5">
                <button
                  onClick={handleDisconnect}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 hover:text-rose-300 transition-all"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="text-xs font-black uppercase tracking-widest">Disconnect Session</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
