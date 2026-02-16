'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { v4 as uuidv4 } from 'uuid';

export default function AuthPage() {
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isBrokerLogin, setIsBrokerLogin] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { signIn } = useAuth();

  const handleBrokerLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (loginId === 'broker-001' && password === 'brokerr') {
      const brokerId = '00000000-0000-0000-0000-000000000001';
      await signIn(brokerId, 'broker');
      toast.success('Welcome back, Master Broker');
      router.push('/broker');
    } else {
      toast.error('Invalid broker credentials');
    }
    setLoading(false);
  };

  const handleTraderLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // For traders, we use their name to find or create a profile
      // In a real "free" login, we can just use a unique ID per session
      let traderId = localStorage.getItem('gt_trader_id');
      
      if (!traderId) {
        traderId = uuidv4();
        localStorage.setItem('gt_trader_id', traderId);
      }

      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', traderId)
        .single();

      if (!existingProfile) {
        const { error: profileError } = await supabase
          .from('profiles')
          .insert([
            { id: traderId, role: 'trader', full_name: fullName || 'Guest Trader' }
          ]);

        if (profileError) throw profileError;

        await supabase
          .from('portfolios')
          .insert([{ user_id: traderId, balance: 0, equity: 0 }]);
      }

      await signIn(traderId, 'trader');
      toast.success('Trader terminal connected');
      router.push('/trader');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-black font-sans">
      <Card className="w-full max-w-md border-zinc-200 dark:border-zinc-800">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold tracking-tight font-space-grotesk">GuardaTrades</CardTitle>
          <CardDescription>
            Professional Terminal Access
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-center gap-4 mb-4">
            <Button 
              variant={!isBrokerLogin ? "default" : "outline"} 
              onClick={() => setIsBrokerLogin(false)}
              className="flex-1"
            >
              Trader Access
            </Button>
            <Button 
              variant={isBrokerLogin ? "default" : "outline"} 
              onClick={() => setIsBrokerLogin(true)}
              className="flex-1"
            >
              Broker Login
            </Button>
          </div>

          {!isBrokerLogin ? (
            <form onSubmit={handleTraderLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="trader-name">Full Name</Label>
                <Input 
                  id="trader-name" 
                  placeholder="Enter your name to start trading" 
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required 
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Connecting...' : 'Connect to Terminal'}
              </Button>
              <p className="text-center text-xs text-zinc-500 italic">
                Free instant access for traders
              </p>
            </form>
          ) : (
            <form onSubmit={handleBrokerLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="broker-id">Broker ID</Label>
                <Input 
                  id="broker-id" 
                  placeholder="broker-xxx" 
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  required 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="broker-password">Password</Label>
                <Input 
                  id="broker-password" 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required 
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Verifying...' : 'Login as Broker'}
              </Button>
            </form>
          )}
        </CardContent>
        <CardFooter className="flex justify-center border-t border-zinc-100 p-4 dark:border-zinc-900">
          <p className="text-xs text-zinc-500">
            Institutional-grade synchronization active.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
