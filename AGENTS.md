## Project Summary
GuardaTrades is a professional trade execution and synchronization platform. It features real-time market connectivity, allowing Brokers to share market signals that Traders can execute instantly. The platform emphasizes precision, performance, and institutional-grade control over account balances.

## Tech Stack
- Frontend: Next.js 15+, React, Tailwind CSS
- Backend: Supabase (Database, Storage)
- Custom Auth: Local storage based session with hardcoded Broker login
- State Management: React Context (Auth)
- Market Data: Professional Market Data Bridge

## Architecture
- `src/lib`: Core logic, Supabase client, Auth context
- `src/app`: Next.js App Router pages (Broker, Trader terminals)
- `src/components`: Reusable UI components
- `src/hooks`: Custom React hooks for trading data

## User Preferences
- No AI educational feedback
- Professional, high-contrast aesthetic
- Institutional control over account balances
- Simplified "free" access for traders

## Project Guidelines
- Single Broker account (broker-001)
- Traders have instant free access
- All balance changes must be backend-validated
- Price-at-trade-time stored for all transactions
- Real-time market prices for all executions

## Common Patterns
- Supabase for data persistence
- Tailwind CSS for responsive, professional UI
