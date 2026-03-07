'use client';

import { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, usePublicClient } from 'wagmi';
import { Loader2, Ticket, Fingerprint, Calendar, Clock, MapPin, ScanLine, CheckCircle, XCircle, BarChart } from 'lucide-react';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '@/config/contracts';
import { decompressFromEncodedURIComponent, compressToEncodedURIComponent } from 'lz-string';
import Link from 'next/link';
import { formatEther } from 'viem';

export default function OrganizerEventPortal({ params }: { params: Promise<{ id: string }> }) {
  const [resolvedId, setResolvedId] = useState<string | null>(null);

  useEffect(() => {
    params.then((p) => setResolvedId(p.id));
  }, [params]);

  const { isConnected, address } = useAccount();

  // Verification state
  const [proofInput, setProofInput] = useState('');
  const [verificationResult, setVerificationResult] = useState<null | boolean>(null);
  const [verificationError, setVerificationError] = useState<string>('');
  const [zkPayload, setZkPayload] = useState<any>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const { data: eventResult, isLoading: isEventLoading } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: CONTRACT_ABI,
    functionName: 'getEventDetails',
    args: resolvedId ? [BigInt(resolvedId)] : undefined,
    query: {
      enabled: !!resolvedId,
    }
  });

  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isSuccess, isLoading: isConfirming } = useWaitForTransactionReceipt({ hash: txHash });
  const publicClient = usePublicClient();

  const eventDetails: any = eventResult;

  const handleVerify = async () => {
    setVerificationError('');
    setVerificationResult(null);
    setZkPayload(null);

    // Client side ZK verification
    try {
      if (!proofInput) return alert("Please paste the buyer's proof payload or scan their QR Code.");
      let parsed;

      // Dual-Mode Parsing: Check if input is raw JSON or compressed Base64
      try {
        const trimmedInput = proofInput.trim();
        if (trimmedInput.startsWith('{')) {
          parsed = JSON.parse(trimmedInput);
        } else {
          const decompressed = decompressFromEncodedURIComponent(trimmedInput);
          if (!decompressed) {
            setVerificationError("Invalid QR Code payload format");
            setVerificationResult(false);
            return;
          }

          // Strict Validation: Defeat lz-string truncation forgery
          // lz-string is fault-tolerant and will output partial json if the end characters are deleted.
          // By re-compressing the output, we guarantee the exact byte-length of the input was processed.
          const validationRecompress = compressToEncodedURIComponent(decompressed);
          if (validationRecompress !== trimmedInput) {
            setVerificationError("Tampered or Truncated QR Payload detected. Verification aborted.");
            setVerificationResult(false);
            return;
          }

          parsed = JSON.parse(decompressed);
        }
      } catch (parseError) {
        setVerificationError("Invalid payload format. The data is corrupted or not valid JSON.");
        setVerificationResult(false);
        return;
      }

      // Check required fields before verifying
      if (!parsed || !parsed.proof || !parsed.publicSignals || !Array.isArray(parsed.publicSignals)) {
        setVerificationError("Invalid payload structure. Missing cryptographic proofs.");
        setVerificationResult(false);
        return;
      }

      let snarkjs = (window as any).snarkjs;
      if (!snarkjs) {
        // Fallback lazy-load for Next.js strict mode drops
        await new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "/snarkjs.min.js";
          script.onload = () => {
            snarkjs = (window as any).snarkjs;
            resolve(true);
          };
          script.onerror = () => reject(new Error("Failed to script load snarkjs"));
          document.body.appendChild(script);
        });
      }

      if (!snarkjs) return alert("snarkjs not loaded.");

      const vKey = await fetch('/zkey/verification_key.json').then(res => res.json());

      // Verify proof BEFORE trusting the public signals (like eventId)
      let res = false;
      try {
        res = await snarkjs.groth16.verify(vKey, parsed.publicSignals, parsed.proof);
      } catch (verifyError) {
        setVerificationError("Cryptographic proof validation failed. Invalid proof formatting.");
        setVerificationResult(false);
        return;
      }

      if (!res) {
        setVerificationError("Cryptographic proof validation failed. Forged ticket.");
        setVerificationResult(false);
        return;
      }

      // Explicitly check that the ticket belongs to THIS event ID
      if (parsed.publicSignals[2] !== String(resolvedId)) {
        setVerificationError(`Ticket Mismatch! This valid ticket was purchased for Event #${parsed.publicSignals[2]}, but you are verifying it at Event #${resolvedId}.`);
        setVerificationResult(false);
        return;
      }

      setVerificationResult(true);

      // Format proof components for Solidity
      const a = [parsed.proof.pi_a[0], parsed.proof.pi_a[1]];
      const b = [
        [parsed.proof.pi_b[0][1], parsed.proof.pi_b[0][0]],
        [parsed.proof.pi_b[1][1], parsed.proof.pi_b[1][0]]
      ];
      const c = [parsed.proof.pi_c[0], parsed.proof.pi_c[1]];
      const input = parsed.publicSignals;

      setZkPayload({ a, b, c, input });
    } catch (e) {
      // Don't console.error to avoid Next.js Error Overlay in Dev
      setVerificationError("An unexpected error occurred during verification.");
      setVerificationResult(false);
    }
  };

  const handleCheckIn = async () => {
    if (!zkPayload) return;

    if (publicClient) {
      try {
        // Convert the string-based decimal Nullifier input into a standard 32-byte EVM hex string
        const hash2Hex = BigInt(zkPayload.input[1]).toString(16).padStart(64, '0');
        const hash2Bytes32 = `0x${hash2Hex}` as `0x${string}`;

        const isUsed = await publicClient.readContract({
          address: CONTRACT_ADDRESS as `0x${string}`,
          abi: CONTRACT_ABI,
          functionName: 'isTicketUsed',
          args: [hash2Bytes32]
        });

        if (isUsed) {
          alert("Ticket Already Scanned! This cryptographic proof has already been marked as used for entry.");
          setZkPayload(null);
          setProofInput('');
          setVerificationResult(null);
          return;
        }
      } catch (checkErr) {
        console.warn("Could not pre-flight check ticket hash:", checkErr);
      }
    }

    writeContract({
      address: CONTRACT_ADDRESS as `0x${string}`,
      abi: CONTRACT_ABI,
      functionName: 'checkInTicket',
      args: [
        [BigInt(zkPayload.a[0]), BigInt(zkPayload.a[1])],
        [
          [BigInt(zkPayload.b[0][0]), BigInt(zkPayload.b[0][1])],
          [BigInt(zkPayload.b[1][0]), BigInt(zkPayload.b[1][1])]
        ],
        [BigInt(zkPayload.c[0]), BigInt(zkPayload.c[1])],
        [BigInt(zkPayload.input[0]), BigInt(zkPayload.input[1]), BigInt(zkPayload.input[2])]
      ]
    });
  };

  if (!mounted) return null;

  if (!resolvedId) return <div className="p-20 text-center"><Loader2 className="animate-spin mx-auto" /></div>;

  if (isEventLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-40">
        <Loader2 className="animate-spin mb-4" size={40} color="var(--primary)" />
        <p className="text-muted text-lg">Loading Event Portal...</p>
      </div>
    );
  }

  if (!eventDetails || eventDetails.eventId === BigInt(0)) {
    return (
      <div className="container mt-8 text-center pt-20">
        <h2 className="text-3xl mb-4">Event Not Found</h2>
      </div>
    );
  }

  // Security barrier: only the organizer can access this page
  if (address && eventDetails.organizer.toLowerCase() !== address.toLowerCase()) {
    return (
      <div className="container mt-8 text-center pt-20">
        <h2 className="text-3xl mb-4 text-danger">Unauthorized</h2>
        <p className="text-muted mb-6">You are not the registered organizer of this event.</p>
        <Link href="/organizer/events" className="btn btn-outline">Return to My Events</Link>
      </div>
    )
  }

  let description = '';
  let displayLocation = eventDetails.isOnline ? 'Online Event' : 'Unknown Location';
  let displayImage = '';

  if (eventDetails.eventURI) {
    try {
      const parsed = JSON.parse(eventDetails.eventURI);
      description = parsed.description || '';
      displayImage = parsed.imageCID || '';
      if (!eventDetails.isOnline && parsed.location) {
        const { venueName, city, streetAddress, country } = parsed.location;
        displayLocation = [venueName, streetAddress, city, country].filter(Boolean).join(', ') || 'Unknown Location';
      }
    } catch (e) {
      console.error(e);
    }
  }

  const startDate = new Date(Number(eventDetails.startTime) * 1000);
  const endDate = new Date(Number(eventDetails.endTime) * 1000);

  const dateOptions: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric', year: 'numeric' };
  const timeOptions: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };

  const startDateStr = startDate.toLocaleDateString('en-US', dateOptions);
  const startTimeStr = startDate.toLocaleTimeString('en-US', timeOptions);
  const endDateStr = endDate.toLocaleDateString('en-US', dateOptions);
  const endTimeStr = endDate.toLocaleTimeString('en-US', timeOptions);

  const ticketsSold = Number(eventDetails.ticketsSold);
  const maxAttendees = Number(eventDetails.maxAttendees);
  const salesPercentage = maxAttendees === 0 ? 0 : Math.min(100, Math.round((ticketsSold / maxAttendees) * 100));
  const isEventLive = Date.now() >= Number(eventDetails.startTime) * 1000 && Date.now() <= Number(eventDetails.endTime) * 1000;
  const isEventCompleted = Date.now() > Number(eventDetails.endTime) * 1000;

  return (
    <div className="container mt-8">

      <div className="card glass-panel mb-2" style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto 2rem auto' }}>
        <h1 className="text-3xl font-bold mb-2">{eventDetails.name} <span className="text-sm font-normal text-muted ml-2">(ID: #{resolvedId})</span></h1>

        <div className="flex flex-col md:flex-row gap-8 mb-6">
          <div className="flex-1">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-muted">
                <Calendar size={18} color="var(--primary)" />
                <span className="text-white font-medium">Starts: {startDateStr} at {startTimeStr}</span>
              </div>
              <div className="flex items-center gap-2 text-muted">
                <Clock size={18} color="var(--primary)" />
                <span className="text-white font-medium">Ends: {endDateStr} at {endTimeStr}</span>
              </div>
              <div className="flex items-center gap-2 text-muted">
                <MapPin size={18} color="var(--primary)" />
                <span className="text-white font-medium">{displayLocation}</span>
              </div>
            </div>
          </div>

          <div className="flex-1" style={{ borderLeft: '1px solid var(--border)', paddingLeft: '2rem' }}>
            <h4 className="text-muted text-sm mb-2 uppercase tracking-wider">Live Metrics</h4>
            <div className="mb-2 flex items-end gap-2">
              <span className="text-3xl font-bold text-primary">{ticketsSold}</span>
              <span className="text-muted pb-1">/ {maxAttendees} Sold</span>
            </div>
            <div className="w-full bg-surface-hover rounded-full h-2 mb-2">
              <div className="bg-primary h-2 rounded-full" style={{ width: `${salesPercentage}%` }}></div>
            </div>
            <div className="text-sm text-muted blur-text">{salesPercentage}% Capacity Reached</div>
            <div className="mt-4 text-sm"><span className="text-muted">Revenue:</span> <span className="font-bold text-accent">{formatEther(BigInt(eventDetails.ticketPrice) * BigInt(eventDetails.ticketsSold))} FLOW</span></div>
          </div>
        </div>
      </div>

      <div className="card glass-panel" style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto 4rem auto' }}>
        <h3 className="text-2xl mb-2 flex items-center gap-2"><ScanLine /> Ticket Check-In Scanner</h3>
        <p className="text-muted mb-6 text-sm">Waiting to scan cryptographic zero-knowledge proofs for this event. Ensure attendees generate their QR code specifically for Event #{resolvedId}.</p>

        {/* Add SnarkJS script to window */}
        <script src="https://cdn.jsdelivr.net/npm/snarkjs@0.7.0/build/snarkjs.min.js"></script>

        {isEventCompleted ? (
          <div className="text-center p-8 mt-4 mb-4 rounded-xl" style={{ border: '1px solid var(--border)' }}>
            <h4 className="text-xl font-bold mb-2" style={{ color: 'var(--text-muted)' }}>Event Completed</h4>
            <p className="text-muted">This event has already ended ({endDateStr} at {endTimeStr}). Ticket verification is now permanently closed.</p>
          </div>
        ) : !isEventLive ? (
          <div className="text-center p-8 mb-4 border border-warning rounded-xl bg-orange-500/10">
            <h4 className="text-xl text-warning font-bold mb-2">Scanner Locked (Event Upcoming)</h4>
            <p className="text-muted">You cannot verify tickets or check attendees in until the official start time ({startDateStr} at {startTimeStr}). Please wait until the event is live.</p>
          </div>
        ) : (
          <>
            <div className="input-group">
              <label className="input-label">Paste Attendee QR ZK Payload</label>
              <textarea
                className="input"
                rows={4}
                value={proofInput}
                onChange={(e) => setProofInput(e.target.value)}
                style={{ fontFamily: 'monospace', fontSize: '13px' }}
                placeholder='{"proof": {...}, "publicSignals": [...]}'
              ></textarea>
            </div>

            <button
              onClick={handleVerify}
              className="btn btn-primary w-full mt-4 flex items-center justify-center gap-2"
              disabled={!proofInput}
            >
              Verify Cryptographic Authenticity
            </button>
          </>
        )}

        <div style={{ minHeight: '1.5rem', width: '100%' }}></div>

        {verificationResult !== null && (
          <div className="mt-6 flex flex-col items-center border rounded" style={{ padding: '1rem 1rem', borderColor: verificationResult ? 'var(--success)' : 'var(--danger)', background: verificationResult ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)' }}>
            {verificationResult ? (
              <>
                <CheckCircle size={48} color="var(--success)" className="mb-4" />
                <h2 className="text-2xl font-bold text-success mb-2">Cryptographically Valid</h2>
                <p className="text-sm text-center text-muted mb-6">This proof was correctly generated by the owner of the ticket without revealing their secret. They are cleared for entry.</p>
                <button
                  onClick={handleCheckIn}
                  className="btn btn-success w-full mt-4 flex items-center justify-center gap-2"
                  disabled={isPending || isConfirming}
                  style={{
                    padding: '1rem',
                    fontSize: '1.1rem',
                  }}
                >
                  {(isPending || isConfirming) ? <><Loader2 className="animate-spin inline-block mr-2" /> Logging Check-In...</> : 'Log On-Chain Check-In'}
                </button>
                {isSuccess && <p className="text-sm text-success mt-2">Checked-in Successfully!</p>}
              </>
            ) : (
              <>
                <XCircle size={48} color="var(--danger)" className="mb-4" />
                <h2 className="text-2xl font-bold text-danger mb-2">Invalid Proof / Counterfeit</h2>
                <p className="text-sm text-center text-muted">{verificationError || "This payload was forged or corrupted. Deny entry."}</p>
              </>
            )}
          </div>
        )}
      </div>

    </div >
  )
}
