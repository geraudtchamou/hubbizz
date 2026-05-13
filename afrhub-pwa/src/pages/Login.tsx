import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Smartphone, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import useAppStore from '../store/appStore';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { setUser } = useAppStore();
  
  const [loginMethod, setLoginMethod] = useState<'phone' | 'email'>('phone');
  const [identifier, setIdentifier] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Simulate API call - replace with actual authentication
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock successful login
      const mockUser = {
        id: '1',
        name: 'Demo User',
        email: loginMethod === 'email' ? identifier : undefined,
        phone: loginMethod === 'phone' ? identifier : undefined,
        role: 'admin' as const,
        storeId: '1',
        createdAt: new Date()
      };

      setUser(mockUser);
      navigate('/');
    } catch (err) {
      setError('Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-white rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg">
            <span className="text-primary-600 font-bold text-4xl">A</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">AfrHub POS</h1>
          <p className="text-primary-100">Mobile-first POS for African traders</p>
        </div>

        {/* Login form */}
        <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Sign In</h2>

          {/* Login method toggle */}
          <div className="flex gap-2 mb-6 p-1 bg-gray-100 rounded-lg">
            <button
              type="button"
              onClick={() => {
                setLoginMethod('phone');
                setIdentifier('');
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md transition-all ${
                loginMethod === 'phone'
                  ? 'bg-white text-primary-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Smartphone className="w-4 h-4" />
              <span>Phone</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setLoginMethod('email');
                setIdentifier('');
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md transition-all ${
                loginMethod === 'email'
                  ? 'bg-white text-primary-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Mail className="w-4 h-4" />
              <span>Email</span>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Identifier input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {loginMethod === 'phone' ? 'Phone Number' : 'Email Address'}
              </label>
              <input
                type={loginMethod === 'phone' ? 'tel' : 'email'}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder={loginMethod === 'phone' ? '+237 6XX XXX XXX' : 'you@example.com'}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
                required
              />
            </div>

            {/* PIN input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                PIN
              </label>
              <div className="relative">
                <input
                  type={showPin ? 'text' : 'password'}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Enter your 4-6 digit PIN"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all pr-12"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Error message */}
            {error && (
              <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary-600 text-white py-3 rounded-lg font-semibold hover:bg-primary-700 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {/* Help text */}
          <p className="mt-6 text-center text-sm text-gray-600">
            Contact your administrator if you don't have an account
          </p>
        </div>

        {/* Footer */}
        <p className="text-center text-primary-100 text-sm mt-6">
          © 2024 AfrHub. Built for African businesses.
        </p>
      </div>
    </div>
  );
};

export default Login;
