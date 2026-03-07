'use client';

import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Ticket, ShieldCheck, Zap } from "lucide-react";
import { useEffect, useRef } from "react";

export default function Home() {
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    // Set up the Intersection Observer for scroll animations
    observerRef.current = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('fade-in-up');
          // Stop observing once animated so it doesn't repeat backwards
          observerRef.current?.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 }); // Trigger when 10% visible

    const elements = document.querySelectorAll('.animate-on-scroll');
    elements.forEach(el => observerRef.current?.observe(el));

    return () => observerRef.current?.disconnect();
  }, []);

  return (
    <>
      {/* Hero Section */}
      <section className="container flex items-center justify-between" style={{ minHeight: '85vh', padding: '4rem 2rem', flexWrap: 'wrap', gap: '4rem' }}>

        {/* Left Column - Text */}
        <div style={{ flex: '1 1 500px' }}>
          <div className="glass-panel animate-on-scroll" style={{ display: 'inline-flex', padding: '0.5rem 1rem', borderRadius: '100px', marginBottom: '2rem', gap: '0.5rem', alignItems: 'center' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }}></span>
            <span className="text-sm font-bold text-muted">Deployed on Flow EVM Testnet</span>
          </div>

          <h1 className="text-5xl font-bold mb-6 animate-on-scroll delay-100" style={{ lineHeight: '1.2' }}>
            Welcome to <br /> <span className="heading-gradient">ZeroPass</span>
          </h1>

          <p className="text-xl text-muted mt-4 mb-8 animate-on-scroll delay-200" style={{ maxWidth: '600px' }}>
            Eliminate data monopolies and greedy middlemen. ZeroPass uses Zero-Knowledge cryptography to protect fan identities and route 100% of revenue directly to organizers.
          </p>

          <div className="flex gap-4 animate-on-scroll delay-300">
            <Link href="/events" className="btn btn-primary" style={{ padding: '1rem 2rem', fontSize: '1.1rem' }}>
              Browse Events <ArrowRight size={20} />
            </Link>
            <Link href="/organizer" className="btn btn-glass" style={{ padding: '1rem 2rem', fontSize: '1.1rem' }}>
              Organize Events <ArrowRight size={20} />
            </Link>
          </div>
        </div>

        {/* Right Column - Illustration */}
        <div className="animate-on-scroll delay-300" style={{ flex: '1 1 400px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: '500px', aspectRatio: '1/1' }}>
            <Image
              src="/logo.png"
              alt="ZeroPass Core Logo"
              fill
              style={{
                objectFit: 'contain',
                filter: 'drop-shadow(0 20px 50px rgba(139, 92, 246, 0.4))',
                borderRadius: '32px',
                mixBlendMode: 'lighten',
                opacity: 0.95
              }}
              priority
            />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mt-16" style={{ padding: '0 2rem', paddingBottom: '8rem' }}>
        <div className="text-center animate-on-scroll" style={{ marginBottom: '3rem' }}>
          <h2 className="text-5xl font-bold mb-6">Built for the <span className="heading-gradient">Future</span></h2>
          <p className="text-xl text-muted" style={{ maxWidth: '600px', margin: '0 auto' }}>A paradigm shift in security and ownership that Web2 platforms cannot natively match.</p>
        </div>

        <div className="flex flex-col" style={{ gap: '10rem' }}>

          {/* Feature 1 */}
          <div className="flex items-center justify-between" style={{ flexWrap: 'wrap', gap: '4rem' }}>
            <div className="animate-on-scroll" style={{ flex: '1 1 400px' }}>
              <div style={{ background: 'rgba(139, 92, 246, 0.1)', width: '80px', height: '80px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '2rem' }}>
                <ShieldCheck size={40} color="var(--primary)" />
              </div>
              <h3 className="text-4xl font-bold mb-6">Zero-Knowledge Privacy</h3>
              <p className="text-xl text-muted" style={{ lineHeight: '1.6' }}>Prove your ticketing identity at the door without ever exposing your sensitive Government IDs to centralized, hackable corporate databases.</p>
            </div>
            <div className="glass-panel animate-on-scroll" style={{ flex: '1 1 400px', height: '350px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(circle at center, rgba(139, 92, 246, 0.15) 0%, transparent 70%)', border: '1px solid rgba(139, 92, 246, 0.2)' }}>
              <ShieldCheck size={140} color="var(--primary)" style={{ filter: 'drop-shadow(0 0 40px rgba(139, 92, 246, 0.6))' }} />
            </div>
          </div>

          {/* Feature 2: Reversed */}
          <div className="flex items-center justify-between" style={{ flexWrap: 'wrap-reverse', gap: '4rem' }}>
            <div className="glass-panel animate-on-scroll" style={{ flex: '1 1 400px', height: '350px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(circle at center, rgba(236, 72, 153, 0.15) 0%, transparent 70%)', border: '1px solid rgba(236, 72, 153, 0.2)' }}>
              <Ticket size={140} color="var(--secondary)" style={{ filter: 'drop-shadow(0 0 40px rgba(236, 72, 153, 0.6))' }} />
            </div>
            <div className="animate-on-scroll" style={{ flex: '1 1 400px' }}>
              <div style={{ background: 'rgba(236, 72, 153, 0.1)', width: '80px', height: '80px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '2rem' }}>
                <Ticket size={40} color="var(--secondary)" />
              </div>
              <h3 className="text-4xl font-bold mb-6">Time-Locked Verification</h3>
              <p className="text-xl text-muted" style={{ lineHeight: '1.6' }}>Generate dynamic QR codes mapped to your identity and digital signature. Tickets remain locked until the precise event start time, guaranteeing authentic attendance.</p>
            </div>
          </div>

          {/* Feature 3 */}
          <div className="flex items-center justify-between" style={{ flexWrap: 'wrap', gap: '4rem' }}>
            <div className="animate-on-scroll" style={{ flex: '1 1 400px' }}>
              <div style={{ background: 'rgba(6, 182, 212, 0.1)', width: '80px', height: '80px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '2rem' }}>
                <Zap size={40} color="var(--accent)" />
              </div>
              <h3 className="text-4xl font-bold mb-6">Minimal Platform Fees</h3>
              <p className="text-xl text-muted" style={{ lineHeight: '1.6' }}>A trustless protocol. Payments route seamlessly from fans directly into the Organizer's wallet with negligible platform extortion fees.</p>
            </div>
            <div className="glass-panel animate-on-scroll" style={{ flex: '1 1 400px', height: '350px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(circle at center, rgba(6, 182, 212, 0.15) 0%, transparent 70%)', border: '1px solid rgba(6, 182, 212, 0.2)' }}>
              <Zap size={140} color="var(--accent)" style={{ filter: 'drop-shadow(0 0 40px rgba(6, 182, 212, 0.6))' }} />
            </div>
          </div>

        </div>
      </section>
    </>
  );
}
