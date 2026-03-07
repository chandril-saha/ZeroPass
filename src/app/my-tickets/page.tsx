'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Fingerprint, Loader2, Eye, EyeOff } from 'lucide-react';
import { useSignMessage, useAccount } from 'wagmi';

export default function MyTicketsLogin() {
  const [secretId, setSecretId] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const router = useRouter();
  const { signMessageAsync } = useSignMessage();
  const { isConnected } = useAccount();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected) {
      alert("Please connect your Web3 wallet using the top right button before unlocking tickets.");
      return;
    }
    if (secretId.length !== 12) {
      alert("Please enter a valid 12-digit Aadhar Card Number.");
      return;
    }

    setIsSigning(true);
    try {
      const signature = await signMessageAsync({
        message: "ZeroPass: Authenticate my Ticket Identity",
      });

      // Combine Staking ID + Wallet Signature Hash
      const combinedEntropy = `${secretId}-${signature}`;

      // Pass strictly through sessionStorage per session instead of persistent localStorage
      sessionStorage.setItem('zeroPass_tempSecret', combinedEntropy);
      router.push('/my-tickets/dashboard');
    } catch (err: any) {
      if (err.message && (err.message.includes('User rejected') || err.name === 'UserRejectedRequestError')) {
        // Suppress console dump for user-initiated cancellations 
        alert("Authentication Cancelled: You must sign the message to verify wallet ownership.");
      } else {
        console.error("Authentication error:", err);
        alert("Authentication error: " + err.message);
      }
    } finally {
      setIsSigning(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="container mt-8 flex flex-col items-center justify-center" style={{ minHeight: '60vh' }}>
      <h1 className="text-4xl font-bold mb-2 text-center">My <span className="heading-gradient">Tickets</span></h1>
      <p className="text-muted mb-8 text-center max-w-lg">Enter your secure 12-digit Aadhar Card Number to access your dashboard and manage your anonymous event check-ins.</p>

      <div className="card glass-panel w-full" style={{ maxWidth: '400px' }}>
        <h3 className="text-2xl mb-4 flex items-center gap-2 justify-center"><Fingerprint /> Authentication Gate</h3>
        <p className="text-muted text-sm mb-2 text-center">Your biometric Aadhar number derives your anonymous identity commitment securely in the browser.</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-4">
          <div className="input-group">
            <div style={{ position: 'relative', width: '100%' }}>
              <input
                type={showSecret ? "text" : "password"}
                className="input text-center text-xl tracking-widest"
                placeholder="0000 0000 0000"
                maxLength={12}
                value={secretId}
                onChange={(e) => setSecretId(e.target.value.replace(/[^0-9]/g, ''))}
                style={{ paddingRight: '2.5rem', paddingLeft: '2.5rem', letterSpacing: '4px', fontFamily: 'monospace', width: '100%' }}
                required
              />
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className="text-muted hover:text-white transition-colors"
                style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                title={showSecret ? "Hide password" : "Show password"}
              >
                {showSecret ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>
          <button type="submit" className="btn btn-primary w-full flex items-center justify-center gap-2" style={{ padding: '0.75rem', fontSize: '1.1rem' }} disabled={isSigning || !isConnected}>
            {!isConnected ? 'Connect Wallet First' : isSigning ? <><Loader2 className="animate-spin" /> Authenticating Wallet...</> : 'Unlock Tickets'}
          </button>
        </form>
      </div>
    </div>
  );
}
