import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

// Two-step, link-free password reset:
//  1) User enters their email -> we send a 6-digit OTP code (not a clickable link).
//  2) User enters the code + a new password, all inside the app.
// This avoids Supabase's raw verify-link URL, which some ISPs block, causing
// "site can't be reached" for anyone clicking the email link directly.
export default function ForgotPasswordPage() {
  const [step, setStep] = useState<'request' | 'verify'>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const { resetPassword, verifyResetOtp } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  async function handleRequestCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await resetPassword(email.trim().toLowerCase());
    setLoading(false);
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } else {
      toast({ title: 'Code sent', description: 'Check your email for a 6-digit code.' });
      setStep('verify');
    }
  }

  async function handleVerifyAndReset(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) { toast({ variant: 'destructive', title: 'Weak password', description: 'Use at least 6 characters.' }); return; }
    if (password !== confirm) { return; } // inline error shown below the field; block submit
    setLoading(true);
    const { error: otpError } = await verifyResetOtp(email.trim().toLowerCase(), code.trim());
    if (otpError) {
      setLoading(false);
      toast({ variant: 'destructive', title: 'Invalid code', description: 'The code is incorrect or has expired. Request a new one.' });
      return;
    }
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) {
      toast({ variant: 'destructive', title: 'Could not update password', description: updateError.message });
      return;
    }
    // verifyResetOtp already established a valid session, and the password is
    // now updated — take the user straight into the app instead of making them
    // log in a second time.
    toast({ title: 'Password updated', description: 'Signing you in...' });
    navigate('/');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Reset Password</CardTitle>
          <CardDescription>
            {step === 'request' ? 'Enter your email to receive a reset code' : 'Enter the code we emailed you and choose a new password'}
          </CardDescription>
        </CardHeader>

        {step === 'request' ? (
          <form onSubmit={handleRequestCode}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-3">
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Sending...' : 'Send Reset Code'}
              </Button>
              <Link to="/login" className="text-sm text-primary hover:underline">
                Back to sign in
              </Link>
            </CardFooter>
          </form>
        ) : (
          <form onSubmit={handleVerifyAndReset}>
            <CardContent className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 text-blue-700 text-xs rounded-lg p-3">
                A 6-digit code was sent to <strong>{email}</strong>. Enter it below along with your new password.
              </div>
              <div className="space-y-2">
                <Label htmlFor="code">Reset Code</Label>
                <Input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  placeholder="123456"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  maxLength={6}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">New Password</Label>
                <Input id="password" type="password" placeholder="At least 6 characters" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">Confirm Password</Label>
                <Input id="confirm" type="password" placeholder="Re-enter password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
                {confirm.length > 0 && password !== confirm && (
                  <p className="text-xs text-destructive">New password and confirm password must be the same.</p>
                )}
              </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-3">
              <Button type="submit" className="w-full" disabled={loading || (confirm.length > 0 && password !== confirm)}>
                {loading ? 'Updating...' : 'Update Password'}
              </Button>
              <div className="flex justify-between w-full text-sm">
                <button type="button" className="text-primary hover:underline" onClick={() => setStep('request')}>
                  Resend code
                </button>
                <Link to="/login" className="text-primary hover:underline">
                  Back to sign in
                </Link>
              </div>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  );
}
