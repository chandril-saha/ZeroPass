'use client';

import { useState } from 'react';
import Link from "next/link";
import { Search, MapPin, Calendar, Clock, Loader2 } from "lucide-react";
import { useReadContracts } from 'wagmi';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '@/config/contracts';
import { formatEther } from 'viem';

export default function EventsMarketplace() {
  const [searchQuery, setSearchQuery] = useState('');

  // In the absence of an indexer or a getTotalEvents() counter, we'll try to fetch IDs 1-20
  const MAX_EVENTS_TO_FETCH = 20;
  const eventIds = Array.from({ length: MAX_EVENTS_TO_FETCH }, (_, i) => i + 1);

  const { data: readResults, isLoading } = useReadContracts({
    contracts: eventIds.map(id => ({
      address: CONTRACT_ADDRESS as `0x${string}`,
      abi: CONTRACT_ABI,
      functionName: 'getEventDetails',
      args: [BigInt(id)],
    }))
  });

  const activeEvents: any[] = [];

  if (readResults) {
    readResults.forEach((result) => {
      if (result.status === 'success' && result.result) {
        const ev: any = result.result;

        let displayLocation = ev.isOnline ? 'Online Event' : 'Unknown Location';
        let displayImage = '';

        if (ev.eventURI) {
          try {
            const parsed = JSON.parse(ev.eventURI);
            displayImage = parsed.imageCID || '';
            if (!ev.isOnline && parsed.location) {
              const { city, country } = parsed.location;
              displayLocation = [city, country].filter(Boolean).join(', ') || 'Unknown Location';
            }
          } catch (e) {
            // Unparsable JSON
          }
        }

        const startDate = new Date(Number(ev.startTime) * 1000);
        const endDate = new Date(Number(ev.endTime) * 1000);

        const dateOptions: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
        const timeOptions: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };

        const startDateStr = startDate.toLocaleDateString('en-US', dateOptions);
        const endDateStr = endDate.toLocaleDateString('en-US', dateOptions);
        const startTimeStr = startDate.toLocaleTimeString('en-US', timeOptions);
        const endTimeStr = endDate.toLocaleTimeString('en-US', timeOptions);

        const dateStr = startDateStr === endDateStr ? startDateStr : `${startDateStr} - ${endDateStr}`;
        const timeStr = `${startTimeStr} - ${endTimeStr}`;

        const isLive = Date.now() >= startDate.getTime() && Date.now() <= endDate.getTime();
        let displayStatus = 'Active';
        if (Date.now() > endDate.getTime()) displayStatus = 'Completed';
        else if (Date.now() < startDate.getTime()) displayStatus = 'Upcoming';

        activeEvents.push({
          id: ev.eventId.toString(),
          name: ev.name,
          image: displayImage,
          venue: displayLocation,
          date: dateStr,
          time: timeStr,
          price: formatEther(ev.ticketPrice),
          isLive,
          status: displayStatus
        });
      }
    });
  }

  return (
    <div className="container mt-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-4xl text-white">Explore <span className="heading-gradient">Events</span></h1>

        <div className="flex gap-4">
          <div className="input-group" style={{ marginBottom: 0 }}>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                className="input"
                placeholder="Search events..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingLeft: '2.5rem', width: '300px' }}
              />
              <Search size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
            </div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="animate-spin mb-4" size={40} color="var(--primary)" />
          <p className="text-muted text-lg">Scanning Blockchain for Events...</p>
        </div>
      ) : activeEvents.length === 0 ? (
        <div className="text-center py-20 card glass-panel">
          <h2 className="text-2xl font-bold mb-2">No Events Found</h2>
          <p className="text-muted">There are currently no active events minted on the platform.</p>
          <div style={{ marginTop: '1rem' }}>
            <Link href="/organizer" className="btn btn-primary">Create the First Event</Link>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '2rem' }}>
          {activeEvents
            .filter((event) => event.name.toLowerCase().includes(searchQuery.toLowerCase()))
            .map((event) => (
              <div key={event.id} className="card" style={{ padding: 0 }}>
                <div style={{ width: '100%', padding: '1rem' }}>
                  <div style={{ display: 'inline-block', background: 'rgba(255,255,255,0.05)', border: `1px solid ${event.status === 'Active' ? 'var(--success)' : event.status === 'Completed' ? 'var(--border)' : 'var(--primary)'}`, padding: '0.25rem 0.75rem', borderRadius: '1rem', fontSize: '0.8rem', color: event.status === 'Active' ? 'var(--success)' : event.status === 'Completed' ? 'var(--text-muted)' : 'var(--primary)', fontWeight: 'bold' }}>
                    {event.status}
                  </div>
                </div>

                <div style={{ padding: '0 1.5rem 1.5rem 1.5rem' }}>
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-xl font-bold truncate pr-2">{event.name}</h3>
                    <span className="text-sm font-bold whitespace-nowrap" style={{ color: 'var(--primary)' }}>{event.price} FLOW</span>
                  </div>

                  <div className="flex flex-col gap-2 mb-6">
                    <span className="text-sm text-muted flex items-center gap-2">
                      <Calendar size={16} /> {event.date}
                    </span>
                    <span className="text-sm text-muted flex items-center gap-2">
                      <Clock size={16} /> {event.time}
                    </span>
                    <span className="text-sm text-muted flex items-center gap-2">
                      <MapPin size={16} /> {event.venue}
                    </span>
                  </div>

                  <Link href={`/events/${event.id}`} className="btn btn-primary w-full mt-4">
                    View Details
                  </Link>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}
