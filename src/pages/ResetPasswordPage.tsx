import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Supabase puts recovery info in the URL hash (#access_token / #error)
    const hash = window.location.hash || '';
    const params = new URLSearchParams(hash.replace(/^#/, ''));
    const errCode = params.get('error_code');
    const errDesc = params.get('error_description');

    if (errCode) {
      // Link expired or already used
      const msg = errCode === 'otp_expired'
        ? 'This reset link has expired. Reset links are valid for a short time — please request a new one.'
        : (errDesc ? decodeURIComponent(errDesc.replace(/\+/g, ' ')) : 'This reset link is invalid or has already been used.');
      setLinkError(msg);
      return;
    }

    // Listen for the recovery session Supabase establishes from the link
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) {
        setReady(true);
      }
    });

    // Also check if a session already exists (link processed)
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) { toast({ variant: 'destructive', title: 'Weak password', description: 'Use at least 6 characters.' }); return; }
    if (password !== confirm) { toast({ variant: 'destructive', title: 'Mismatch', description: 'Passwords do not match.' }); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast({ variant: 'destructive', title: 'Could not update password', description: error.message });
    } else {
      toast({ title: 'Password updated', description: 'You can now sign in with your new password.' });
      await supabase.auth.signOut();
      navigate('/login');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center mb-4">
            <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none" className="h-6 w-6">
                <path d="M8 16l5 5 11-11" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>
          <CardTitle className="text-2xl">Set New Password</CardTitle>
          <CardDescription>Choose a new password for your account</CardDescription>
        </CardHeader>

        {linkError ? (
          <CardContent className="space-y-4 text-center">
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{linkError}</div>
            <Button className="w-full" onClick={() => navigate('/forgot-password')}>Request a new reset link</Button>
            <Button variant="ghost" className="w-full" onClick={() => navigate('/login')}>Back to sign in</Button>
          </CardContent>
        ) : !ready ? (
          <CardContent className="text-center py-8 text-sm text-muted-foreground">Verifying reset link...</CardContent>
        ) : (
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">New Password</Label>
                <Input id="password" type="password" placeholder="At least 6 characters" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">Confirm Password</Label>
                <Input id="confirm" type="password" placeholder="Re-enter password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-3">
              <Button type="submit" className="w-full" disabled={loading}>{loading ? 'Updating...' : 'Update Password'}</Button>
              <Button variant="ghost" className="w-full" onClick={() => navigate('/login')}>Back to sign in</Button>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  );
}
