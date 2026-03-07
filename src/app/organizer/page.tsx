import Link from "next/link";
import { PlusCircle, CalendarDays } from "lucide-react";

export default function OrganizerDashboard() {
  return (
    <div className="container mt-8">
      <h1 className="text-4xl mb-2">Organizer <span className="heading-gradient">Dashboard</span></h1>
      <p className="text-muted mb-8">Manage your zero-knowledge events and verify attendee tickets securely.</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>

        {/* Create Event Card */}
        <Link href="/organizer/create" className="card flex flex-col items-center justify-center text-center group" style={{ minHeight: '250px', cursor: 'pointer' }}>
          <div style={{ background: 'rgba(139, 92, 246, 0.1)', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto', transition: '0.2s' }}>
            <PlusCircle size={32} color="var(--primary)" />
          </div>
          <h3 className="text-2xl mb-2">Create Event</h3>
          <p className="text-muted text-sm">Deploy a new event on-chain and set ticketing parameters.</p>
        </Link>

        {/* My Events Card */}
        <Link href="/organizer/events" className="card flex flex-col items-center justify-center text-center group" style={{ minHeight: '250px', cursor: 'pointer' }}>
          <div style={{ background: 'rgba(6, 182, 212, 0.1)', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto', transition: '0.2s' }}>
            <CalendarDays size={32} color="var(--accent)" />
          </div>
          <h3 className="text-2xl mb-2">My Events</h3>
          <p className="text-muted text-sm">View details, sales, and statuses of your authored events.</p>
        </Link>



      </div>
    </div>
  )
}
