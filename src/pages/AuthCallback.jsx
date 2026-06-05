import { useEffect } from 'react';
import { supabase } from '@/api/supabaseClient';

export default function AuthCallback() {
  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      console.log('session user:', session?.user?.email);
      if (!session?.user) {
        window.location.href = '/login';
        return;
      }

      const { data: allowed, error } = await supabase
        .from('allowed_admins')
        .select('email')
        .eq('email', session.user.email)
        .maybeSingle();

      console.log('allowed:', allowed, 'error:', error);

      if (!allowed) {
        await supabase.auth.signOut();
        window.location.href = '/login?error=unauthorized';
        return;
      }

      window.location.href = '/admin';
    };

    check();
  }, []);

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background">
      <div className="w-8 h-8 border-4 border-secondary/30 border-t-secondary rounded-full animate-spin" />
    </div>
  );
}
