'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { Loader2, LineChart, ArrowRight, ArrowLeft, Mail, Lock, User, Phone, CheckCircle2, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

export default function HomePage() {
  const [mode, setMode] = useState<'login' | 'signup' | 'otp'>('login');
  const [isBrokerMode, setIsBrokerMode] = useState(false);
  const [step, setStep] = useState(1); // For multi-step signup
  const [loading, setLoading] = useState(false);
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();

  // Form State
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    password: '',
    otp: ''
  });

  useEffect(() => {
    if (!authLoading && user && profile) {
      router.push(profile.role === 'broker' ? '/broker' : '/trader');
    }
  }, [user, profile, authLoading, router]);

  const updateForm = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step < 3) {
      setStep(step + 1);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: `${formData.firstName} ${formData.lastName}`,
            phone_number: formData.phone,
            role: 'trader' // Default to trader for public signup
          }
        }
      });

      if (error) throw error;

      if (data.user) {
        await supabase.from('profiles').upsert({
          id: data.user.id,
          role: 'trader',
          full_name: `${formData.firstName} ${formData.lastName}`,
          phone_number: formData.phone,
          broker_id: null,
          last_seen_at: new Date().toISOString()
        }, { onConflict: 'id' });
        await supabase.from('portfolios').upsert({
          user_id: data.user.id,
          balance: 0,
          last_bonus_percent: 0,
          is_first_deposit: true
        }, { onConflict: 'user_id' });

        toast.success('Registration successful! Please check your email for the verification code.');
        setMode('otp');
      }
    } catch (error: any) {
      toast.error(error.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Bypassing Supabase for the institutional broker account
      if (isBrokerMode) {
        if (formData.email.toLowerCase() === 'broker-001' && formData.password === 'brokerr') {
          // Success! We manually redirect since this is a trusted hardcoded account
          toast.success('Broker terminal authorized.');
          router.push('/broker');
          return;
        } else {
          toast.error('Invalid broker credentials.');
          setLoading(false);
          return;
        }
      }

      // Standard trader login via Supabase Auth
      if (!isBrokerMode) {
        // Trusted Test Trader Bypass
        if (formData.email.toLowerCase() === 'mukulu@gmail.com' && formData.password === 'mukulu123') {
          toast.success('Trusted trader session authorized.');
          router.push('/trader');
          return;
        }

        const { error } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password
        });

        if (error) throw error;
        toast.success('Access granted. Initializing terminal...');
      }
    } catch (error: any) {
      toast.error(error.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: formData.email,
        token: formData.otp,
        type: 'signup'
      });

      if (error) throw error;
      toast.success('Identity verified. Welcome to GuardaTrades.');
    } catch (error: any) {
      toast.error(error.message || 'Invalid verification code');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-black">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#050505] px-4 font-sans selection:bg-indigo-500/30 overflow-hidden relative">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-950/20 via-transparent to-transparent pointer-events-none" />
      <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none" />

      <Card className="w-full max-w-md border-white/5 bg-zinc-950/50 backdrop-blur-3xl shadow-2xl shadow-indigo-500/10 relative z-10">
        <CardHeader className="space-y-4 text-center pb-8">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-500/10 border border-indigo-500/20 shadow-xl shadow-indigo-500/5 transition-transform hover:scale-105 duration-300">
            <LineChart className="h-8 w-8 text-indigo-400" />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-4xl font-black tracking-tighter text-white font-space-grotesk bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60">
              GuardaTrades
            </CardTitle>
            <CardDescription className="text-zinc-500 text-[10px] uppercase tracking-[0.3em] font-black">
              {isBrokerMode ? 'Institutional Broker Terminal' : (mode === 'login' ? 'Welcome Back, Trader' : mode === 'signup' ? 'Join GuardaTrades' : 'Identity Verification')}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">
                  {isBrokerMode ? 'Broker Terminal ID' : 'Email Address'}
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-zinc-600" />
                  <Input 
                    type="text"
                    placeholder={isBrokerMode ? "Broker-001" : "name@example.com"} 
                    value={formData.email}
                    onChange={(e) => updateForm('email', e.target.value)}
                    required 
                    className="h-11 pl-10 border-white/5 bg-white/5 text-white placeholder:text-zinc-700 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all rounded-xl"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-zinc-600" />
                  <Input 
                    type="password"
                    placeholder="••••••••" 
                    value={formData.password}
                    onChange={(e) => updateForm('password', e.target.value)}
                    required 
                    className="h-11 pl-10 border-white/5 bg-white/5 text-white placeholder:text-zinc-700 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all rounded-xl"
                  />
                </div>
              </div>
              <Button type="submit" className="w-full bg-indigo-600 text-white hover:bg-indigo-500 transition-all font-black h-12 mt-4 rounded-xl shadow-lg shadow-indigo-500/20 group" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                  <span className="flex items-center gap-2">LOG IN <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" /></span>
                )}
              </Button>
            </form>
          )}

          {mode === 'signup' && (
            <form onSubmit={handleSignup} className="space-y-4">
              {/* Progress Bar */}
              <div className="flex gap-1 mb-6">
                {[1, 2, 3].map(i => (
                  <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-500 ${step >= i ? 'bg-indigo-500' : 'bg-white/5'}`} />
                ))}
              </div>

              {step === 1 && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">First Name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-4 w-4 text-zinc-600" />
                      <Input 
                        placeholder="First name" 
                        value={formData.firstName}
                        onChange={(e) => updateForm('firstName', e.target.value)}
                        required 
                        className="h-11 pl-10 border-white/5 bg-white/5 text-white rounded-xl"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Last Name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-4 w-4 text-zinc-600" />
                      <Input 
                        placeholder="Last name" 
                        value={formData.lastName}
                        onChange={(e) => updateForm('lastName', e.target.value)}
                        required 
                        className="h-11 pl-10 border-white/5 bg-white/5 text-white rounded-xl"
                      />
                    </div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Phone Number</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-3 h-4 w-4 text-zinc-600" />
                      <Input 
                        type="tel"
                        placeholder="+1 (555) 000-0000" 
                        value={formData.phone}
                        onChange={(e) => updateForm('phone', e.target.value)}
                        required 
                        className="h-11 pl-10 border-white/5 bg-white/5 text-white rounded-xl"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Institutional Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-zinc-600" />
                      <Input 
                        type="email"
                        placeholder="name@company.com" 
                        value={formData.email}
                        onChange={(e) => updateForm('email', e.target.value)}
                        required 
                        className="h-11 pl-10 border-white/5 bg-white/5 text-white rounded-xl"
                      />
                    </div>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Create Access Key</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-zinc-600" />
                      <Input 
                        type="password"
                        placeholder="Minimum 8 characters" 
                        value={formData.password}
                        onChange={(e) => updateForm('password', e.target.value)}
                        required 
                        className="h-11 pl-10 border-white/5 bg-white/5 text-white rounded-xl"
                      />
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/10 text-[10px] text-zinc-500 leading-relaxed">
                    By clicking register, you agree to the institutional terms of service and market data compliance regulations.
                  </div>
                </div>
              )}

              <div className="flex gap-3 mt-6">
                {step > 1 && (
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setStep(step - 1)}
                    className="flex-1 border-white/5 bg-white/5 text-white hover:bg-white/10 h-12 rounded-xl"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" /> BACK
                  </Button>
                )}
                <Button type="submit" className="flex-[2] bg-indigo-600 text-white hover:bg-indigo-500 transition-all font-black h-12 rounded-xl" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                    <span className="flex items-center gap-2">
                      {step === 3 ? 'COMPLETE REGISTRATION' : 'CONTINUE'} <ArrowRight className="h-4 w-4" />
                    </span>
                  )}
                </Button>
              </div>
            </form>
          )}

          {mode === 'otp' && (
            <form onSubmit={handleVerifyOTP} className="space-y-6">
              <div className="text-center space-y-2">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/20">
                  <Mail className="h-6 w-6 text-emerald-400" />
                </div>
                <h3 className="text-sm font-bold text-white">Verification Sent</h3>
                <p className="text-xs text-zinc-500 px-4">
                  A unique 6-digit access code has been dispatched to <span className="text-indigo-400 font-bold">{formData.email}</span>
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1 text-center block w-full">Enter 6-Digit Code</Label>
                <Input 
                  placeholder="000000" 
                  value={formData.otp}
                  onChange={(e) => updateForm('otp', e.target.value)}
                  maxLength={6}
                  required 
                  className="h-14 text-center text-2xl font-black tracking-[0.5em] border-white/5 bg-white/5 text-white rounded-xl"
                />
              </div>

              <Button type="submit" className="w-full bg-emerald-600 text-white hover:bg-emerald-500 transition-all font-black h-12 rounded-xl shadow-lg shadow-emerald-500/20" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                  <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> VERIFY IDENTITY</span>
                )}
              </Button>
              
              <button 
                type="button"
                onClick={() => setMode('signup')}
                className="w-full text-[10px] text-zinc-600 font-bold uppercase tracking-widest hover:text-zinc-400 transition-colors"
              >
                Change email address
              </button>
            </form>
          )}
        </CardContent>

        <CardFooter className="flex flex-col gap-4 border-t border-white/5 p-6 pt-6 bg-white/[0.01]">
          <div className="w-full flex justify-between items-center text-[10px] font-black tracking-widest">
            {isBrokerMode ? (
              <p className="text-zinc-600 uppercase text-center w-full">Institutional access only. Please contact administration for credentials.</p>
            ) : mode === 'login' ? (
              <>
                <span className="text-zinc-600 uppercase">New to GuardaTrades?</span>
                <button 
                  onClick={() => { setMode('signup'); setStep(1); }}
                  className="text-indigo-400 hover:text-indigo-300 transition-colors uppercase underline underline-offset-4"
                >
                  Sign Up →
                </button>
              </>
            ) : (
              <>
                <span className="text-zinc-600 uppercase">Already a member?</span>
                <button 
                  onClick={() => setMode('login')}
                  className="text-indigo-400 hover:text-indigo-300 transition-colors uppercase underline underline-offset-4"
                >
                  Log In →
                </button>
              </>
            )}
          </div>
        </CardFooter>
      </Card>
      
      {/* Footer Legal & Broker Links */}
      <div className="mt-8 flex flex-wrap justify-center gap-x-8 gap-y-4 z-10 px-4">
        <button 
          onClick={() => {
            setIsBrokerMode(!isBrokerMode);
            setMode('login');
          }}
          className={`text-[10px] font-black uppercase tracking-widest transition-colors ${
            isBrokerMode ? 'text-indigo-400 underline underline-offset-4' : 'text-zinc-600 hover:text-indigo-400'
          }`}
        >
          {isBrokerMode ? 'Trader Portal' : 'Broker Access'}
        </button>
        <Link href="/terms" className="text-[10px] font-black uppercase tracking-widest text-zinc-600 hover:text-indigo-400 transition-colors">Terms of Service</Link>
        <Link href="/policy" className="text-[10px] font-black uppercase tracking-widest text-zinc-600 hover:text-indigo-400 transition-colors">Privacy Policy</Link>
      </div>
      
      {/* System Status Indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-6 opacity-30 grayscale hover:grayscale-0 hover:opacity-60 transition-all duration-700">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-3 w-3 text-emerald-500" />
          <span className="text-[8px] font-black uppercase tracking-[0.2em] text-white">SSL Encryption Active</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-1 w-1 rounded-full bg-indigo-500 animate-ping" />
          <span className="text-[8px] font-black uppercase tracking-[0.2em] text-white">Market Gateway: Online</span>
        </div>
      </div>
    </div>
  );
}
