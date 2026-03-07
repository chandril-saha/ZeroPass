'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount, useReadContract, usePublicClient } from 'wagmi';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '@/config/contracts';
import { QrCode, Calendar, Clock, MapPin, Loader2, Share } from 'lucide-react';
import { createHash } from 'crypto';
import { buildPoseidon } from 'circomlibjs';
import { QRCodeSVG } from 'qrcode.react';
import { compressToEncodedURIComponent } from 'lz-string';
import { formatEther } from 'viem';

// ZK Proof Generator wrapper
const generateProof = async (secretStr: string, eventId: string) => {
  let snarkjs = (window as any).snarkjs;
  if (!snarkjs) {
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "/snarkjs.min.js";
      script.onload = () => {
        snarkjs = (window as any).snarkjs;
        resolve(true);
      };
      script.onerror = () => reject(new Error("Failed to load snarkjs script"));
      document.body.appendChild(script);
    });
  }

  if (!snarkjs) throw new Error("snarkjs not loaded");

  const secretScalar = BigInt('0x' + createHash('sha256').update(secretStr).digest('hex')) % BigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617");

  const input = {
    secret: secretScalar.toString(),
    eventId: eventId.toString()
  };

  try {
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      input,
      "/wasm/circuit.wasm",
      "/zkey/circuit_final.zkey"
    );
    return { proof, publicSignals };
  } catch (error) {
    console.error(error);
    throw new Error("Failed to generate zkProof.");
  }
};

// Internal Card Component for displaying Ticket event metrics
const TicketCard = ({ tokenId, secretId, onProofData }: { tokenId: bigint, secretId: string, onProofData: (data: any) => void }) => {
  const publicClient = usePublicClient();
  const [eventDetails, setEventDetails] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    const fetchDetails = async () => {
      if (!publicClient) return;
      try {
        const eventId = await publicClient.readContract({
          address: CONTRACT_ADDRESS as `0x${string}`,
          abi: CONTRACT_ABI,
          functionName: 'ticketToEvent',
          args: [tokenId]
        }) as bigint;

        const details = await publicClient.readContract({
          address: CONTRACT_ADDRESS as `0x${string}`,
          abi: CONTRACT_ABI,
          functionName: 'getEventDetails',
          args: [eventId]
        }) as any;

        setEventDetails({ ...details, eventId });
      } catch (err) {
        console.error("Error fetching ticket mapping to event details", err);
      }
    };
    fetchDetails();
  }, [publicClient, tokenId]);

  if (!eventDetails) return <div className="card glass-panel flex justify-center p-8"><Loader2 className="animate-spin text-primary" /></div>;

  const startDate = new Date(Number(eventDetails.startTime) * 1000);
  const endDate = new Date(Number(eventDetails.endTime) * 1000);
  const isLive = Date.now() >= startDate.getTime() && Date.now() <= endDate.getTime();
  const isCompleted = Date.now() > endDate.getTime();
  const displayStatus = isCompleted ? 'Completed' : isLive ? 'Active' : 'Upcoming';

  const dateOptions: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
  const timeOptions: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };
  const startDateStr = startDate.toLocaleDateString('en-US', dateOptions);
  const endDateStr = endDate.toLocaleDateString('en-US', dateOptions);
  const startTimeStr = startDate.toLocaleTimeString('en-US', timeOptions);
  const endTimeStr = endDate.toLocaleTimeString('en-US', timeOptions);
  const dateStr = startDateStr === endDateStr ? startDateStr : `${startDateStr} - ${endDateStr}`;
  const timeStr = `${startTimeStr} - ${endTimeStr}`;

  let displayLocation = eventDetails.isOnline ? 'Online Event' : 'Unknown Location';
  if (eventDetails.eventURI) {
    try {
      const parsed = JSON.parse(eventDetails.eventURI);
      if (!eventDetails.isOnline && parsed.location) {
        const { city, country } = parsed.location;
        displayLocation = [city, country].filter(Boolean).join(', ') || 'Unknown Location';
      }
    } catch (e) { }
  }

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const data = await generateProof(secretId, eventDetails.eventId.toString());
      onProofData({ ...data, tokenId: Number(tokenId) });
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="card flex flex-col justify-between" style={{ padding: 0 }}>
      {/* Dynamic Status Header */}
      <div style={{ width: '100%', padding: '1rem' }}>
        <div style={{ display: 'inline-block', background: 'rgba(255,255,255,0.05)', border: `1px solid ${displayStatus === 'Active' ? 'var(--success)' : displayStatus === 'Completed' ? 'var(--border)' : 'var(--primary)'}`, padding: '0.25rem 0.75rem', borderRadius: '1rem', fontSize: '0.8rem', color: displayStatus === 'Active' ? 'var(--success)' : displayStatus === 'Completed' ? 'var(--text-muted)' : 'var(--primary)', fontWeight: 'bold' }}>
          {displayStatus}
        </div>
      </div>

      <div style={{ padding: '0 1.5rem 1.5rem 1.5rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-xl font-bold truncate pr-2">{eventDetails.name}</h3>
          <span className="text-sm font-bold opacity-75 whitespace-nowrap">Ticket #{Number(tokenId)}</span>
        </div>

        <div className="flex flex-col gap-2 mb-6 flex-1">
          <span className="text-sm text-muted flex items-center gap-2">
            <Calendar size={16} /> {dateStr}
          </span>
          <span className="text-sm text-muted flex items-center gap-2">
            <Clock size={16} /> {timeStr}
          </span>
          <span className="text-sm text-muted flex items-center gap-2">
            <MapPin size={16} /> {displayLocation}
          </span>
        </div>

        <button
          onClick={handleGenerate}
          disabled={!isLive || isGenerating}
          className="btn btn-primary w-full mt-4 flex items-center justify-center gap-2"
        >
          {isGenerating ? <><Loader2 className="animate-spin" size={18} /> Compiling Proof...</> : <><QrCode size={18} /> Generate QR Code</>}
        </button>
      </div>
    </div>
  );
};

export default function MyTicketsDashboard() {
  const router = useRouter();
  const { isConnected } = useAccount();

  const [secretId, setSecretId] = useState<string | null>(null);
  const [hash1, setHash1] = useState<`0x${string}`>('0x0');
  const [proofData, setProofData] = useState<any>(null);
  const [showRawJson, setShowRawJson] = useState(false);

  // Authenticate heavily against session state
  useEffect(() => {
    const sId = sessionStorage.getItem('zeroPass_tempSecret');
    if (!sId) {
      router.push('/my-tickets');
      return;
    }
    setSecretId(sId);

    // Process crypto pipeline
    const derive = async () => {
      try {
        const poseidon = await buildPoseidon();
        const F = poseidon.F;
        const secretScalar = BigInt('0x' + createHash('sha256').update(sId).digest('hex')) % BigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617");
        const hash = poseidon([secretScalar]);
        const hashHex = F.toString(hash, 16);
        setHash1(`0x${hashHex.padStart(64, '0')}` as `0x${string}`);
      } catch (err) {
        console.error(err);
      }
    };
    derive();
  }, [router]);

  const { data: tickets, isLoading } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: CONTRACT_ABI,
    functionName: 'getTicketsByUser',
    args: [hash1],
    query: {
      enabled: hash1 !== '0x0'
    }
  }) as { data: bigint[], isLoading: boolean };

  const { data: loyaltyPoints } = useReadContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    abi: CONTRACT_ABI,
    functionName: 'loyaltyPoints',
    args: [hash1],
    query: {
      enabled: hash1 !== '0x0'
    }
  }) as { data: bigint };

  if (!secretId || hash1 === '0x0') {
    return (
      <div className="container mt-8 text-center flex flex-col items-center justify-center" style={{ minHeight: '50vh' }}>
        <Loader2 className="animate-spin text-primary mt-4" size={48} />
        <p className="text-muted mt-4">Authenticating Zero-Knowledge Dashboard...</p>
      </div>
    );
  }

  return (
    <div className="container mt-8">
      {/* Add SnarkJS globally */}
      <script src="https://cdn.jsdelivr.net/npm/snarkjs@0.7.0/build/snarkjs.min.js"></script>

      <div className="flex justify-between items-end mb-8 border-b border-white/10 pb-4">
        <div>
          <h1 className="text-4xl font-bold mb-2">My <span className="heading-gradient">Tickets Dashboard</span></h1>
          <p className="text-muted">Tickets linked to your anonymous cryptographic identity.</p>
        </div>
        <div className="flex flex-col items-end gap-3">
          <div style={{ background: 'rgba(139, 92, 246, 0.15)', border: '1px solid var(--primary)', padding: '0.4rem 1rem', borderRadius: '50px', color: 'white', fontWeight: 'bold' }}>
            🌟 {loyaltyPoints ? Number(loyaltyPoints).toString() : '0'} Loyalty Points
          </div>
          <button className="btn btn-glass" style={{ marginTop: '1rem' }} onClick={() => {
            sessionStorage.removeItem('zeroPass_tempSecret');
            router.push('/my-tickets');
          }}>Log Out</button>
        </div>
      </div>

      {proofData && (
        <div className="card text-center mb-4" style={{ border: '1px solid var(--primary)', background: 'rgba(139, 92, 246, 0.05)' }}>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl text-success flex items-center justify-center gap-2 m-0"><QrCode /> Ready for Check-in (Token #{proofData.tokenId})</h3>
            <button onClick={() => setProofData(null)} className="btn btn-glass" style={{ padding: '0.5rem' }}>✕</button>
          </div>
          <p className="text-sm text-muted">Present this code to the event organizer at the entrance. Your secret identity remains hidden.</p>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', marginTop: '2rem' }}>
            {!showRawJson ? (
              <div style={{ background: 'white', padding: '1.5rem', borderRadius: '12px' }}>
                <QRCodeSVG
                  value={compressToEncodedURIComponent(JSON.stringify({ proof: proofData.proof, publicSignals: proofData.publicSignals }))}
                  size={300}
                  level="Q"
                />
              </div>
            ) : (
              <pre style={{ background: 'var(--surface)', padding: '1rem', borderRadius: '8px', overflowX: 'auto', fontSize: '0.8rem', textAlign: 'left', width: '100%' }}>
                {JSON.stringify({ proof: proofData.proof, publicSignals: proofData.publicSignals }, null, 2)}
              </pre>
            )}

            <button
              onClick={() => setShowRawJson(!showRawJson)}
              className="btn btn-glass"
              style={{ fontSize: '0.9rem', padding: '0.5rem 1rem' }}
            >
              {showRawJson ? "Show Compiled QR Code" : "Show Raw JSON"}
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-center p-12"><Loader2 className="animate-spin inline-block text-primary" size={32} /></div>
      ) : tickets && tickets.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '2rem' }}>
          {tickets.map((tokenId, i) => (
            <TicketCard
              key={i}
              tokenId={tokenId}
              secretId={secretId}
              onProofData={setProofData}
            />
          ))}
        </div>
      ) : (
        <div className="text-center p-12 card glass-panel">
          <p className="text-xl font-bold mb-2">No Tickets Found</p>
          <p className="text-muted">There are no verifiable tickets connected to this identity payload.</p>
        </div>
      )}
    </div>
  );
}
