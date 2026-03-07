'use client';

import { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useSignMessage, usePublicClient } from 'wagmi';
import { Loader2, Ticket, Fingerprint, Calendar, Clock, MapPin, Eye, EyeOff } from 'lucide-react';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '@/config/contracts';
import { createHash } from 'crypto';
import { buildPoseidon } from 'circomlibjs';
import Link from 'next/link';
import { formatEther } from 'viem';

export default function EventDetails({ params }: { params: Promise<{ id: string }> }) {
  const [resolvedId, setResolvedId] = useState<string | null>(null);

  useEffect(() => {
    params.then((p) => setResolvedId(p.id));
  }, [params]);

  const { isConnected, status: accountStatus, address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [secretId, setSecretId] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [usePoints, setUsePoints] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Generates Identity Commitment (hash1) using Poseidon scalar hash matching the Circom circuit
  const getPoseidonHash = async (secretStr: string) => {
    const poseidon = await buildPoseidon();
    const F = poseidon.F;
    // Derive a strong 254-bit scalar field element from the user's password/secret string
    const secretScalar = BigInt('0x' + createHash('sha256').update(secretStr).digest('hex')) % BigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617");

    const hash = poseidon([secretScalar]);
    const hashHex = F.toString(hash, 16);
    return `0x${hashHex.padStart(64, '0')}` as `0x${string}`;
  };

  const { data: eventDetails, isLoading, status, error: readError, refetch: refetchEvent } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: CONTRACT_ABI,
    functionName: 'getEventDetails',
    args: resolvedId ? [BigInt(resolvedId)] : undefined,
    query: {
      enabled: !!resolvedId
    }
  }) as { data: any, isLoading: boolean, status: string, error: any, refetch: any };

  const { writeContract, data: txHash, error: writeError, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });
  const publicClient = usePublicClient();

  // Read the new walletTicketCount to enforce 4-ticket limit
  const { data: walletTickets, refetch: refetchWallet } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: CONTRACT_ABI,
    functionName: 'walletTicketCount',
    args: resolvedId && address ? [BigInt(resolvedId), address] : undefined,
    query: {
      enabled: !!resolvedId && !!address
    }
  });
  const purchasedCount = walletTickets ? Number(walletTickets) : 0;
  const ticketsLeft = Math.max(0, 4 - purchasedCount);
  const isWalletMaxed = ticketsLeft <= 0;

  useEffect(() => {
    if (isSuccess) {
      refetchEvent();
      refetchWallet();
    }
  }, [isSuccess, refetchEvent, refetchWallet]);

  const handlePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected || accountStatus !== 'connected') return alert("Please fully connect and authorize your wallet before purchasing.");
    if (!secretId || secretId.length !== 12) return alert("Please enter a valid 12-digit Aadhar Card number.");
    if (!eventDetails) return;

    try {
      // 2FA Wallet Signature Generation
      const signature = await signMessageAsync({
        message: "ZeroPass: Authenticate my Ticket Identity",
      });

      // Combine Staking ID + Wallet Signature Hash
      const combinedEntropy = `${secretId}-${signature}`;

      // Derive identity commitment mathematically bound to both factors
      const hash1 = await getPoseidonHash(combinedEntropy);

      // Pre-Flight Check: Ensure this Aadhar Number hasn't already bought a ticket for this specific event
      if (publicClient) {
        try {
          const userEventIds = await publicClient.readContract({
            address: CONTRACT_ADDRESS as `0x${string}`,
            abi: CONTRACT_ABI,
            functionName: 'getUserEvents',
            args: [hash1]
          }) as bigint[];

          if (userEventIds.includes(BigInt(resolvedId!))) {
            alert("Double Purchase Blocked: This 12-Digit Aadhar Card Number has already been used to purchase a ticket for this event.");
            return;
          }
        } catch (checkErr) {
          console.warn("Could not pre-flight check user tickets:", checkErr);
        }
      }

      writeContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: CONTRACT_ABI,
        functionName: 'purchaseTicket',
        args: [hash1, BigInt(resolvedId!), usePoints],
        value: usePoints ? BigInt(0) : eventDetails.ticketPrice,
      });
    } catch (err: any) {
      if (err.message && (err.message.includes('User rejected') || err.name === 'UserRejectedRequestError')) {
        // Suppress the console error dump for intentional user cancellations
        alert("Transaction Cancelled: You must sign the authentication message to securely lock your tickets.");
      } else {
        console.error("Encryption error:", err);
        alert("Encryption error: " + err.message);
      }
    }
  };

  if (!mounted) return null;

  if (!resolvedId || isLoading) {
    return (
      <div className="container mt-8 text-center flex flex-col items-center justify-center" style={{ minHeight: '40vh' }}>
        <Loader2 className="animate-spin mb-4" size={48} color="var(--primary)" />
        <h2 className="text-2xl font-bold">Loading Event Details...</h2>
        <p className="text-muted mt-2">Connecting to Flow Testnet</p>
      </div>
    );
  }

  // If the contract throws a revert (EventNotFound), readError will be populated and eventDetails will be undefined.
  if (!eventDetails && !isLoading) {
    return (
      <div className="container mt-8 text-center flex flex-col items-center justify-center p-8 glass-panel" style={{ minHeight: '40vh', maxWidth: '600px', margin: '4rem auto' }}>
        <h2 className="text-3xl font-bold mb-4">Event Not Found</h2>
        <p className="text-xl text-muted mb-8 text-center">
          It looks like Event #{resolvedId} hasn't been minted on the blockchain yet! If you are on a fresh smart contract deployment, you'll need to create an event first.
        </p>
        <Link href="/organizer" className="btn btn-primary" style={{ padding: '1rem 2rem', fontSize: '1.2rem' }}>
          Go to Organizer Dashboard
        </Link>
      </div>
    );
  }

  let displayLocation = eventDetails?.isOnline ? 'Online Event' : 'Unknown Location';

  let description = 'Loading details...';
  if (eventDetails?.eventURI) {
    try {
      const parsed = JSON.parse(eventDetails.eventURI);
      description = parsed.description || description;
      if (!eventDetails.isOnline && parsed.location) {
        const { city, country } = parsed.location;
        displayLocation = [city, country].filter(Boolean).join(', ') || 'Unknown Location';
      }
    } catch (e) {
      description = eventDetails.eventURI;
    }
  } else if (eventDetails?.description) {
    description = eventDetails.description;
  }

  let startDateStr = 'TBD';
  let startTimeStr = 'TBD';
  let endDateStr = 'TBD';
  let endTimeStr = 'TBD';

  if (eventDetails?.startTime && eventDetails?.endTime) {
    const startDate = new Date(Number(eventDetails.startTime) * 1000);
    const endDate = new Date(Number(eventDetails.endTime) * 1000);
    startDateStr = startDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    startTimeStr = startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    endDateStr = endDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    endTimeStr = endDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }

  const isEventCompleted = eventDetails?.endTime ? Date.now() > Number(eventDetails.endTime) * 1000 : false;
  const maxAttendees = eventDetails?.maxAttendees ? Number(eventDetails.maxAttendees) : Infinity;
  const ticketsSold = eventDetails?.ticketsSold ? Number(eventDetails.ticketsSold) : 0;
  const isSoldOut = ticketsSold >= maxAttendees;

  return (
    <div className="container mt-8">
      <div className="card glass-panel" style={{ padding: '3rem', maxWidth: '800px', margin: '0 auto' }}>
        <h1 className="text-4xl font-bold mb-6">{eventDetails?.name || `Event #${resolvedId}`}</h1>

        <p className="text-xl text-muted mb-8 leading-relaxed">{description}</p>

        <div className="flex flex-col gap-3" style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border)', borderRadius: '1.5rem', padding: '1rem 1.5rem', marginBottom: '3rem' }}>
          <div className="flex items-center gap-4 text-muted">
            <Calendar size={20} color="var(--primary)" />
            <span className="text-lg text-white font-medium">Starts: {startDateStr} at {startTimeStr}</span>
          </div>
          <div className="flex items-center gap-4 text-muted">
            <Clock size={20} color="var(--primary)" />
            <span className="text-lg text-white font-medium">Ends: {endDateStr} at {endTimeStr}</span>
          </div>
          <div className="flex items-center gap-4 text-muted">
            <MapPin size={20} color="var(--primary)" />
            <span className="text-lg text-white font-medium">{displayLocation}</span>
          </div>
        </div>

        <form onSubmit={handlePurchase} style={{ borderTop: '1px solid var(--border)', paddingTop: '2rem', marginTop: '1rem' }}>
          <h3 className="text-2xl mb-4 flex items-center gap-2"><Ticket /> Secure Ticket Purchase</h3>

          <div className="input-group mb-6">
            <label className="input-label flex items-center gap-2 mb-2">
              <Fingerprint size={16} color="var(--primary)" />
              12-Digit Aadhar Card Number (Required for zkProof Generation)
            </label>
            <div style={{ position: 'relative', width: '100%' }}>
              <input
                required
                type={showSecret ? "text" : "password"}
                className="input"
                placeholder="0000 0000 0000"
                maxLength={12}
                value={secretId}
                // Strip all non-numeric characters instantly
                onChange={(e) => setSecretId(e.target.value.replace(/[^0-9]/g, ''))}
                style={{ paddingRight: '3rem', width: '100%', letterSpacing: '2px', fontFamily: 'monospace' }}
              />
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className="text-muted hover:text-white transition-colors"
                style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                title={showSecret ? "Hide password" : "Show password"}
              >
                {showSecret ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <p className="text-sm text-muted mt-2">You will need this Aadhar Card number on the day of the event to generate an anonymous proof and enter the venue.</p>
          </div>

          <div className="input-group mb-6" style={{ flexDirection: 'row', alignItems: 'center', background: 'rgba(139, 92, 246, 0.05)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(139, 92, 246, 0.2)' }}>
            <input
              type="checkbox"
              id="usePoints"
              checked={usePoints}
              onChange={(e) => setUsePoints(e.target.checked)}
              style={{ width: '1.2rem', height: '1.2rem', accentColor: 'var(--primary)', cursor: 'pointer' }}
            />
            <label htmlFor="usePoints" style={{ cursor: 'pointer', userSelect: 'none', display: 'flex', flexDirection: 'column' }}>
              <span className="font-bold text-white">Redeem 100 Loyalty Points for a Free Ticket</span>
              <span className="text-sm text-muted">You earn 100 points every time you attend an event. (Transaction will fail if balance is insufficient)</span>
            </label>
          </div>

          <button
            type="submit"
            className={`btn ${isWalletMaxed ? 'btn-outline border-danger text-danger' : 'btn-primary'} w-full`}
            style={{ padding: '1rem', fontSize: '1.1rem' }}
            disabled={isPending || isConfirming || !isConnected || accountStatus !== 'connected' || isEventCompleted || isSoldOut || isWalletMaxed}
          >
            {isWalletMaxed ? (
              "Wallet Limit Reached (Max 4 Tickets)"
            ) : isEventCompleted ? (
              "Event Completed - Sales Closed"
            ) : isSoldOut ? (
              "Sales Closed - Tickets Sold Out"
            ) : isPending || isConfirming ? (
              <><Loader2 className="animate-spin" /> Processing Transaction...</>
            ) : (
              usePoints ? `Redeem 100 Points & Mint (${ticketsLeft} allowed)` : `Pay ${eventDetails?.ticketPrice ? formatEther(eventDetails.ticketPrice) + ' FLOW' : 'Loading...'} & Mint (${ticketsLeft} allowed)`
            )}
          </button>

          {isSuccess && (
            <div className="mt-4 p-4 text-center rounded" style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', border: '1px solid var(--success)' }}>
              Ticket Minted! Transaction Hash: {txHash}
            </div>
          )}

          {writeError && (
            <div className="mt-4 p-4 text-center rounded" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', border: '1px solid var(--danger)' }}>
              Error: {writeError.message}
            </div>
          )}
        </form>
      </div>
    </div>
  )
}
