import { useState, FormEvent } from 'react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  updateProfile
} from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { LogIn, Mail, Lock, User, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

type AuthMode = 'login' | 'signup';

export function Login() {
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    if (!email || !password || (mode === 'signup' && !name)) {
      toast.error('Please fill in all fields');
      return;
    }

    setIsLoading(true);
    try {
      if (mode === 'signup') {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName: name });
        toast.success('Account created successfully!');
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        toast.success('Welcome back!');
      }
    } catch (error: any) {
      console.error(error);
      let message = 'An error occurred. Please try again.';
      if (error.code === 'auth/email-already-in-use') message = 'Email already in use.';
      if (error.code === 'auth/invalid-credential') message = 'Invalid email or password.';
      if (error.code === 'auth/weak-password') message = 'Password should be at least 6 characters.';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-natural p-4 font-sans text-stone-900 relative selection:bg-lemon/30">
      <div className="absolute inset-0 bg-grid-stone opacity-50 z-0"></div>
      
      {/* Decorative Citrus Background Elements */}
      <motion.div 
        animate={{ 
          y: [0, -20, 0],
          rotate: [0, 10, 0]
        }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-20 left-20 text-lemon opacity-20 hidden lg:block"
      >
        <img src="/Lemon.jpg" alt="" className="w-full opacity-10" />
      </motion.div>
      <motion.div 
        animate={{ 
          y: [0, 20, 0],
          rotate: [0, -10, 0]
        }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        className="absolute bottom-20 right-20 w-40 h-40 opacity-10 hidden lg:block"
      >
        <img src="/Lemon.jpg" alt="" className="w-full opacity-10" />
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="w-full max-w-md bg-white rounded-[48px] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.1)] p-10 md:p-12 border border-stone-100 relative z-10"
      >
        <div className="flex flex-col items-center text-center space-y-6 mb-10">
          <motion.div 
            whileHover={{ rotate: 15, scale: 1.1 }}
            className="w-24 h-24 bg-white rounded-[32px] flex items-center justify-center text-stone-800 shadow-2xl shadow-lemon/30 transform transition-all duration-500 overflow-hidden border-4 border-lemon"
          >
            <img src="/Lemon.jpg" alt="Mr Lemon Logo" className="w-full h-full object-cover" />
          </motion.div>
          <div>
            <h1 className="text-5xl font-black text-stone-900 tracking-tighter leading-none italic">MR LEMON</h1>
            <p className="text-stone-500 font-black uppercase tracking-[0.4em] text-xs mt-4 flex items-center justify-center gap-3">
              <span className="w-2 h-2 bg-lemon rounded-full"></span>
              {mode === 'login' ? 'Staff Login' : 'Create Account'}
              <span className="w-2 h-2 bg-lemon rounded-full"></span>
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <AnimatePresence mode="wait">
            {mode === 'signup' && (
              <motion.div
                initial={{ opacity: 0, height: 0, y: -10 }}
                animate={{ opacity: 1, height: 'auto', y: 0 }}
                exit={{ opacity: 0, height: 0, y: -10 }}
                className="space-y-3"
              >
                <div className="relative group">
                  <User className="absolute left-6 top-1/2 -translate-y-1/2 text-stone-300 group-focus-within:text-lemon transition-colors" size={24} />
                  <input
                    type="text"
                    placeholder="Full Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-stone-50 border-2 border-stone-100 rounded-[32px] pl-16 pr-8 py-6 font-black text-stone-900 placeholder:text-stone-300 focus:outline-none focus:border-lemon transition-all shadow-inner text-base"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-6">
            <div className="relative group">
              <Mail className="absolute left-6 top-1/2 -translate-y-1/2 text-stone-300 group-focus-within:text-lemon transition-colors" size={24} />
              <input
                type="email"
                placeholder="Email Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-stone-50 border-2 border-stone-100 rounded-[32px] pl-16 pr-8 py-6 font-black text-stone-900 placeholder:text-stone-300 focus:outline-none focus:border-lemon transition-all shadow-inner text-base"
              />
            </div>

            <div className="relative group">
              <Lock className="absolute left-6 top-1/2 -translate-y-1/2 text-stone-300 group-focus-within:text-lemon transition-colors" size={24} />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-stone-50 border-2 border-stone-100 rounded-[32px] pl-16 pr-8 py-6 font-black text-stone-900 placeholder:text-stone-300 focus:outline-none focus:border-lemon transition-all shadow-inner text-base"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-stone-800 hover:bg-stone-900 text-white font-black uppercase tracking-[0.2em] text-xs py-7 rounded-[32px] shadow-2xl shadow-stone-900/20 transition-all flex items-center justify-center gap-4 group active:scale-95 disabled:opacity-50 disabled:grayscale"
          >
            {isLoading ? (
              <span className="animate-spin h-6 w-6 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <>
                {mode === 'login' ? 'Login' : 'Sign Up'}
                <ArrowRight size={20} className="group-hover:translate-x-2 transition-transform" />
              </>
            )}
          </button>
        </form>

        <div className="mt-12 text-center text-sm font-black">
          <p className="text-stone-400 uppercase tracking-widest">
            {mode === 'login' ? "Need an account?" : "Already have an account?"}
            <button 
              onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
              className="ml-4 text-stone-900 hover:text-lemon transition-colors underline decoration-stone-200 underline-offset-8"
            >
              {mode === 'login' ? 'Register' : 'Login'}
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
