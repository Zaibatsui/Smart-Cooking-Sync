import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Flame, Loader2 } from 'lucide-react';
import { toast } from '../hooks/use-toast';

const GOOGLE_CLIENT_ID = '290192977244-s10usgacsfmi5abkm3o8hm6evje8bi92.apps.googleusercontent.com';

const Login = () => {
  const navigate = useNavigate();
  const { isAuthenticated, loginWithGoogle, loading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [googleScriptLoaded, setGoogleScriptLoaded] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, authLoading, navigate]);

  // Load Google Identity Services script
  useEffect(() => {
    // Check if script already exists
    if (window.google?.accounts?.id) {
      setGoogleScriptLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      setGoogleScriptLoaded(true);
    };
    script.onerror = () => {
      console.error('Failed to load Google Identity Services');
      toast({
        title: 'Error',
        description: 'Failed to load Google Sign-In. Please refresh the page.',
        variant: 'destructive'
      });
    };
    document.body.appendChild(script);

    return () => {
      // Cleanup script if component unmounts before load
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  // Initialize Google Sign-In when script loads
  useEffect(() => {
    if (!googleScriptLoaded || !window.google?.accounts?.id) return;

    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleGoogleCallback,
      auto_select: false,
      cancel_on_tap_outside: true,
    });

    // Render the Google button
    window.google.accounts.id.renderButton(
      document.getElementById('google-signin-button'),
      {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: 'signin_with',
        shape: 'rectangular',
        logo_alignment: 'left',
        width: 300,
      }
    );
  }, [googleScriptLoaded]);

  // Handle Google callback
  const handleGoogleCallback = async (response) => {
    setIsLoading(true);
    try {
      const result = await loginWithGoogle(response.credential);
      
      if (result.success) {
        toast({
          title: 'Welcome!',
          description: `Signed in as ${result.user.name}`
        });
        navigate('/');
      } else {
        toast({
          title: 'Login Failed',
          description: result.error,
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Login error:', error);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50 px-4">
      <Card className="w-full max-w-md border-emerald-200 shadow-xl">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4 p-3 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 w-fit shadow-lg">
            <Flame className="w-10 h-10 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold text-slate-800">
            Smart Cooking Sync
          </CardTitle>
          <CardDescription className="text-slate-600">
            Sign in to sync your cooking plans across devices
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="space-y-4">
            {/* Google Sign-In Button Container */}
            <div className="flex justify-center">
              {isLoading ? (
                <Button disabled className="w-[300px] h-[40px]">
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Signing in...
                </Button>
              ) : (
                <div id="google-signin-button" className="flex justify-center"></div>
              )}
            </div>

            {!googleScriptLoaded && (
              <div className="flex justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
              </div>
            )}

            <p className="text-xs text-center text-slate-500 mt-4">
              By signing in, you agree to our Terms of Service and Privacy Policy.
              Your cooking data will be synced securely.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
