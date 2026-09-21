import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// Legacy route. Password reset now uses an in-app OTP code flow (see
// ForgotPasswordPage) instead of emailed magic links, because Supabase's raw
// verify-link URL is blocked by some ISPs. Anyone landing here (old bookmark
// or old email) is redirected to start the OTP flow instead.
export default function ResetPasswordPage() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate('/forgot-password', { replace: true });
  }, [navigate]);
  return null;
}
