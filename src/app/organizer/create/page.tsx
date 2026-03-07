'use client';

import { useState, useEffect } from 'react';
import { useWriteContract, useWaitForTransactionReceipt, useAccount } from 'wagmi';
import { parseEther } from 'viem';
import { Loader2 } from 'lucide-react';
// Note: You must compile and deploy the ZeroPass.sol then insert the address and ABI here.
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '@/config/contracts';

export default function CreateEvent() {
  const { isConnected, status } = useAccount();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    startTime: '',
    endTime: '',
    venueName: '',
    streetAddress: '',
    city: '',
    state: '',
    postalCode: '',
    country: '',
    isOnline: false,
    ticketPrice: '',
    maxAttendees: '',
    isPrivate: false
  });

  const { writeContract, data: hash, error: writeError, isPending } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected || status !== 'connected') {
      alert("Please fully connect and authorize your wallet first.");
      return;
    }

    const startTimestamp = Math.floor(new Date(formData.startTime).getTime() / 1000);
    const endTimestamp = Math.floor(new Date(formData.endTime).getTime() / 1000);
    const currentTimestamp = Math.floor(Date.now() / 1000);

    if (startTimestamp <= currentTimestamp) {
      alert("Validation Error: The event start time must be explicitly in the future.");
      return;
    }
    if (endTimestamp <= startTimestamp) {
      alert("Validation Error: The end time must logically occur after the start time.");
      return;
    }
    if (Number(formData.maxAttendees) <= 0) {
      alert("Validation Error: The maximum attendees must be at least 1.");
      return;
    }

    // Compress all non-essential UI details into a single URI string (Mocking an IPFS upload)
    const metadataURI = JSON.stringify({
      description: formData.description,
      location: {
        venueName: formData.venueName,
        streetAddress: formData.streetAddress,
        city: formData.city,
        state: formData.state,
        postalCode: formData.postalCode,
        country: formData.country,
      }
    });

    writeContract({
      address: CONTRACT_ADDRESS as `0x${string}`,
      abi: CONTRACT_ABI,
      functionName: 'createEvent',
      args: [{
        name: formData.name,
        eventURI: metadataURI,
        startTime: BigInt(startTimestamp),
        endTime: BigInt(endTimestamp),
        isOnline: formData.isOnline,
        ticketPrice: parseEther(formData.ticketPrice || '0'),
        maxAttendees: BigInt(formData.maxAttendees),
        isPrivate: formData.isPrivate
      }],
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    setFormData(prev => ({ ...prev, [name]: val }));
  };

  return (
    <div className="container mt-8" style={{ maxWidth: '800px' }}>
      <h1 className="text-3xl mb-2">Create New <span className="heading-gradient">Event</span></h1>
      <p className="text-muted mb-8">Fill in the details below to deploy your event to the Flow EVM.</p>

      <form onSubmit={handleSubmit} className="card">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div className="input-group" style={{ gridColumn: '1 / -1' }}>
            <label className="input-label">Event Name</label>
            <input required type="text" name="name" value={formData.name} onChange={handleChange} className="input" placeholder="e.g. ETH Global Summit" />
          </div>

          <div className="input-group" style={{ gridColumn: '1 / -1' }}>
            <label className="input-label">Description</label>
            <textarea required name="description" value={formData.description} onChange={handleChange} className="input" placeholder="Event details..." rows={3}></textarea>
          </div>

          <div className="input-group">
            <label className="input-label">Start Time</label>
            <input required type="datetime-local" name="startTime" value={formData.startTime} onChange={handleChange} className="input" />
          </div>

          <div className="input-group">
            <label className="input-label">End Time</label>
            <input required type="datetime-local" name="endTime" value={formData.endTime} onChange={handleChange} className="input" />
          </div>

          <div className="input-group">
            <label className="input-label">Max Attendees</label>
            <input required type="number" name="maxAttendees" value={formData.maxAttendees} onChange={handleChange} className="input" placeholder="100" />
          </div>

          <div className="input-group">
            <label className="input-label">Ticket Price (FLOW)</label>
            <input required type="number" step="0.0001" name="ticketPrice" value={formData.ticketPrice} onChange={handleChange} className="input" placeholder="0.5" />
          </div>

          <div className="input-group" style={{ gridColumn: '1 / -1' }}>
            <h4 className="mt-4 mb-2">Location Details</h4>
          </div>

          <div className="input-group">
            <label className="input-label flex items-center gap-2">
              <input type="checkbox" name="isOnline" checked={formData.isOnline} onChange={handleChange} />
              This is an online event
            </label>
          </div>

          {!formData.isOnline && (
            <>
              <div className="input-group" style={{ gridColumn: '1 / -1' }}>
                <label className="input-label">Venue Name</label>
                <input type="text" name="venueName" value={formData.venueName} onChange={handleChange} className="input" />
              </div>
              <div className="input-group">
                <label className="input-label">City</label>
                <input type="text" name="city" value={formData.city} onChange={handleChange} className="input" />
              </div>
              <div className="input-group">
                <label className="input-label">Country</label>
                <input type="text" name="country" value={formData.country} onChange={handleChange} className="input" />
              </div>
            </>
          )}

        </div>

        <div className="mt-8 flex justify-center">
          <button type="submit" className="btn btn-primary w-full mt-6" style={{ gridColumn: '1 / -1', padding: '1rem', fontSize: '1.2rem' }} disabled={isPending || isConfirming || !isConnected || status !== 'connected'}>
            {isPending || isConfirming ? <><Loader2 className="animate-spin inline-block mr-2" /> Deploying Event to Blockchain...</> : 'Create Event on Chain'}
          </button>
        </div>
      </form>

      {isSuccess && (
        <div className="glass-panel text-center mt-8 mb-8" style={{ padding: '2rem', border: '1px solid var(--success)', background: 'rgba(16, 185, 129, 0.1)' }}>
          <h3 className="text-xl" style={{ color: 'var(--success)' }}>Event Created Successfully!</h3>
          <p className="text-muted mt-2">Transaction Hash: {hash}</p>
        </div>
      )}

      {writeError && (
        <div className="glass-panel text-center mt-8 mb-8" style={{ padding: '2rem', border: '1px solid var(--danger)', background: 'rgba(239, 68, 68, 0.1)' }}>
          <h3 className="text-xl" style={{ color: 'var(--danger)' }}>
            {(writeError as any).message?.includes('User rejected') || (writeError as any).name === 'UserRejectedRequestError'
              ? 'Transaction Cancelled'
              : 'Transaction Failed'}
          </h3>
          <p className="text-muted mt-2 text-sm" style={{ wordBreak: 'break-word' }}>
            {(writeError as any).message?.includes('User rejected') || (writeError as any).name === 'UserRejectedRequestError'
              ? 'You rejected the signature request in your wallet.'
              : 'An error occurred while deploying the event. Please check the transaction details and try again.'}
          </p>
        </div>
      )}
    </div>
  )
}
