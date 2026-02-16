'use client';

import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    TradingView: any;
  }
}

export function TradingViewChart({ onTrade, showControls = true }: { onTrade?: (symbol: string, type: 'buy' | 'sell') => void, showControls?: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentSymbol, setCurrentSymbol] = useState('BTCUSDT');
  const [selectedType, setSelectedType] = useState<'buy' | 'sell'>('buy');
  const widgetRef = useRef<any>(null);

  const symbols = [
    { label: 'BTC/USDT', value: 'BINANCE:BTCUSDT', short: 'BTCUSDT' },
    { label: 'ETH/USDT', value: 'BINANCE:ETHUSDT', short: 'ETHUSDT' },
    { label: 'SOL/USDT', value: 'BINANCE:SOLUSDT', short: 'SOLUSDT' },
    { label: 'XRP/USDT', value: 'BINANCE:XRPUSDT', short: 'XRPUSDT' },
    { label: 'EUR/USD', value: 'FX:EURUSD', short: 'EURUSD' },
    { label: 'GOLD', value: 'TVC:GOLD', short: 'GOLD' },
  ];

  useEffect(() => {
    const scriptId = 'tradingview-widget-script';
    let script = document.getElementById(scriptId) as HTMLScriptElement;

    const initWidget = () => {
      if (!containerRef.current) return;
      
      const selected = symbols.find(s => s.short === currentSymbol) || symbols[0];

      if (widgetRef.current) {
        // If widget exists, just change the symbol for better performance
        try {
          widgetRef.current.setSymbol(selected.value, '15', () => {});
          return;
        } catch (e) {
          // Fallback to re-creation if setSymbol fails
        }
      }

      containerRef.current.innerHTML = '';
      const widgetContainer = document.createElement('div');
      widgetContainer.id = 'tradingview_advanced_chart';
      widgetContainer.style.height = '100%';
      widgetContainer.style.width = '100%';
      containerRef.current.appendChild(widgetContainer);

      widgetRef.current = new window.TradingView.widget({
        autosize: true,
        symbol: selected.value,
        interval: '15',
        timezone: 'Etc/UTC',
        theme: 'dark',
        style: '1',
        locale: 'en',
        toolbar_bg: '#0a0a0a',
        enable_publishing: false,
        allow_symbol_change: true,
        container_id: 'tradingview_advanced_chart',
        backgroundColor: '#0a0a0a',
        gridColor: 'rgba(255,255,255,0.03)',
        hide_side_toolbar: false,
        details: true,
        hotlist: true,
        calendar: true,
        show_popup_button: true,
        popup_width: '1000',
        popup_height: '650',
        studies: [
          'MASimple@tv-basicstudies',
          'RSI@tv-basicstudies',
          'StochasticRSI@tv-basicstudies'
        ],
        disabled_features: ['header_symbol_search'],
        enabled_features: ['study_templates'],
        overrides: {
          "paneProperties.background": "#0a0a0a",
          "paneProperties.vertGridProperties.color": "rgba(255,255,255,0.03)",
          "paneProperties.horzGridProperties.color": "rgba(255,255,255,0.03)",
          "symbolWatermarkProperties.transparency": 90,
          "scalesProperties.textColor": "#AAA"
        }
      });
    };

    if (window.TradingView) {
      initWidget();
    } else {
      script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://s3.tradingview.com/tv.js';
      script.async = true;
      script.onload = initWidget;
      document.head.appendChild(script);
    }

    return () => {
      // Don't remove script to allow caching, but we could clean up widget if needed
    };
  }, [currentSymbol]);

  const handleTrade = () => {
    onTrade?.(currentSymbol, selectedType);
  };

  return (
    <div className="space-y-0 rounded-2xl overflow-hidden border border-white/5 bg-[#0a0a0a] flex flex-col h-full min-h-[650px]">
      {/* Symbol selector bar */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-white/5 bg-white/[0.02] overflow-x-auto shrink-0">
        {symbols.map(s => (
          <button
            key={s.short}
            onClick={() => setCurrentSymbol(s.short)}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
              currentSymbol === s.short
                ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5 border border-transparent'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Chart container */}
      <div className="flex-1 w-full relative min-h-[500px]">
        <div ref={containerRef} className="absolute inset-0 w-full h-full" />
      </div>

      {/* Trade execution bar */}
      {showControls && (
        <div className="flex items-center gap-3 px-4 py-3 border-t border-white/5 bg-white/[0.02] shrink-0">
          <div className="flex items-center gap-1 bg-white/5 rounded-xl p-1">
            <button
              onClick={() => setSelectedType('buy')}
              className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                selectedType === 'buy'
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                  : 'text-zinc-500 hover:text-emerald-400'
              }`}
            >
              BUY
            </button>
            <button
              onClick={() => setSelectedType('sell')}
              className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                selectedType === 'sell'
                  ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30'
                  : 'text-zinc-500 hover:text-rose-400'
              }`}
            >
              SELL
            </button>
          </div>
          <div className="flex-1 text-center">
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
              {currentSymbol} &middot; Market Order
            </span>
          </div>
          <button
            onClick={handleTrade}
            className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all text-white ${
              selectedType === 'buy'
                ? 'bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-500/20'
                : 'bg-rose-600 hover:bg-rose-500 shadow-lg shadow-rose-500/20'
            }`}
          >
            {onTrade ? `EXECUTE ${selectedType.toUpperCase()}` : `VIEW ${selectedType.toUpperCase()}`}
          </button>
        </div>
      )}
    </div>
  );
}

export function MarketTickerTape() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || containerRef.current.querySelector('script')) return;

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js';
    script.async = true;
    script.innerHTML = JSON.stringify({
      symbols: [
        { proName: 'BINANCE:BTCUSDT', title: 'BTC/USDT' },
        { proName: 'BINANCE:ETHUSDT', title: 'ETH/USDT' },
        { proName: 'BINANCE:SOLUSDT', title: 'SOL/USDT' },
        { proName: 'FX:EURUSD', title: 'EUR/USD' },
        { proName: 'TVC:GOLD', title: 'Gold' },
      ],
      showSymbolLogo: true,
      isTransparent: true,
      displayMode: 'adaptive',
      colorTheme: 'dark',
      locale: 'en',
    });

    containerRef.current.appendChild(script);
  }, []);

  return (
    <div ref={containerRef} className="tradingview-widget-container w-full border-b border-white/5 h-[46px] overflow-hidden">
      <div className="tradingview-widget-container__widget"></div>
    </div>
  );
}
