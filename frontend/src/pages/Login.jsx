import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Flame, Loader2, UserCircle } from 'lucide-react';
import { toast } from '../hooks/use-toast';

const GOOGLE_CLIENT_ID = '290192977244-s10usgacsfmi5abkm3o8hm6evje8bi92.apps.googleusercontent.com';
const PREVIEW_URL = 'culinary-login.preview.emergentagent.com';

const Login = () => {
  const navigate = useNavigate();
  const { isAuthenticated, loginWithGoogle, loading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [googleScriptLoaded, setGoogleScriptLoaded] = useState(false);
  
  // Check if we're on the preview URL
  const isPreviewMode = window.location.hostname === PREVIEW_URL || 
                        window.location.hostname === 'localhost' ||
                        window.location.hostname.includes('preview.emergentagent.com');
  
  // Check for dark mode from localStorage
  const getSavedTheme = () => {
    const saved = localStorage.getItem('cookingSyncSettings');
    if (saved) {
      try {
        const settings = JSON.parse(saved);
        return settings?.theme || 'light';
      } catch {
        return 'light';
      }
    }
    return 'light';
  };
  
  const [theme] = useState(getSavedTheme());
  
  // Apply theme on mount
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

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
      // Don't show error toast on preview - demo login is available
      if (!isPreviewMode) {
        toast({
          title: 'Error',
          description: 'Failed to load Google Sign-In. Please refresh the page.',
          variant: 'destructive'
        });
      }
    };
    document.body.appendChild(script);

    return () => {
      // Cleanup script if component unmounts before load
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, [isPreviewMode]);

  // Initialize Google Sign-In when script loads
  useEffect(() => {
    if (!googleScriptLoaded || !window.google?.accounts?.id) return;

    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleGoogleCallback,
      auto_select: false,
      cancel_on_tap_outside: true,
    });

    // Render the Google button with theme-aware styling
    const buttonContainer = document.getElementById('google-signin-button');
    if (buttonContainer) {
      window.google.accounts.id.renderButton(
        buttonContainer,
        {
          type: 'standard',
          theme: theme === 'dark' ? 'filled_black' : 'outline',
          size: 'large',
          text: 'signin_with',
          shape: 'rectangular',
          logo_alignment: 'left',
          width: 300,
        }
      );
    }
  }, [googleScriptLoaded, theme]);

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

  // Demo login for preview mode
  const handleDemoLogin = async () => {
    setIsLoading(true);
    try {
      // Create a demo user session
      const demoUser = {
        id: 'demo-user-' + Date.now(),
        email: 'demo@cookingsync.app',
        name: 'Demo User',
        picture: ''
      };
      
      // Create a simple demo token (this is just for preview testing)
      // In production, this would go through proper Google OAuth
      const demoToken = btoa(JSON.stringify({
        userId: demoUser.id,
        email: demoUser.email,
        name: demoUser.name,
        exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
      }));
      
      // Store in localStorage (same as real auth)
      localStorage.setItem('auth_token', demoToken);
      localStorage.setItem('auth_user', JSON.stringify(demoUser));
      
      // Manually set the auth state by triggering a page reload
      // This ensures AuthContext picks up the new token
      toast({
        title: 'Demo Mode Active',
        description: 'Logged in as Demo User for testing'
      });
      
      // Small delay then reload to let AuthContext verify the token
      setTimeout(() => {
        window.location.href = '/';
      }, 500);
      
    } catch (error) {
      console.error('Demo login error:', error);
      toast({
        title: 'Error',
        description: 'Demo login failed',
        variant: 'destructive'
      });
      setIsLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${theme === 'dark' ? 'bg-[#111827]' : 'bg-gradient-to-br from-emerald-50 via-white to-teal-50'}`}>
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex items-center justify-center px-4 ${theme === 'dark' ? 'bg-[#111827]' : 'bg-gradient-to-br from-emerald-50 via-white to-teal-50'}`}>
      <Card className={`w-full max-w-md shadow-xl ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'border-emerald-200'}`}>
        <CardHeader className="text-center pb-2">
          <div className={`mx-auto mb-4 p-3 rounded-xl w-fit shadow-lg ${theme === 'dark' ? 'bg-gradient-to-br from-emerald-600 to-emerald-700' : 'bg-gradient-to-br from-emerald-500 to-teal-600'}`}>
            <Flame className="w-10 h-10 text-white" />
          </div>
          <CardTitle className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>
            Smart Cooking Sync
          </CardTitle>
          <CardDescription className={theme === 'dark' ? 'text-gray-300' : 'text-slate-600'}>
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

            {!googleScriptLoaded && !isPreviewMode && (
              <div className="flex justify-center">
                <Loader2 className={`w-6 h-6 animate-spin ${theme === 'dark' ? 'text-gray-400' : 'text-slate-400'}`} />
              </div>
            )}

            {/* Demo Login Button - Only on Preview URL */}
            {isPreviewMode && !isLoading && (
              <>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className={`w-full border-t ${theme === 'dark' ? 'border-gray-600' : 'border-gray-300'}`} />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className={`px-2 ${theme === 'dark' ? 'bg-gray-800 text-gray-400' : 'bg-white text-gray-500'}`}>
                      Preview Mode
                    </span>
                  </div>
                </div>
                
                <Button
                  onClick={handleDemoLogin}
                  variant="outline"
                  className={`w-full h-11 ${theme === 'dark' ? 'border-emerald-600 text-emerald-400 hover:bg-emerald-900/30' : 'border-emerald-500 text-emerald-600 hover:bg-emerald-50'}`}
                >
                  <UserCircle className="w-5 h-5 mr-2" />
                  Continue as Demo User
                </Button>
                
                <p className={`text-xs text-center ${theme === 'dark' ? 'text-amber-400' : 'text-amber-600'}`}>
                  ⚠️ Demo mode - Data will not persist across sessions
                </p>
              </>
            )}

            <p className={`text-xs text-center mt-4 ${theme === 'dark' ? 'text-gray-400' : 'text-slate-500'}`}>
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
