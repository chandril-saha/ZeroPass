'use client'

import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { useState, useEffect } from 'react'
import { Wallet, LogOut, Loader2 } from 'lucide-react'

export function WalletConnect() {
  const { address, isConnected, isConnecting, isReconnecting, status } = useAccount()
  const { connectors, connect } = useConnect()
  const { disconnect } = useDisconnect()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return <div className="btn btn-glass skeleton" style={{ width: '140px', height: '40px' }}></div>

  if (isConnected && status === 'connected' && address) {
    const shortAddress = `${address.slice(0, 6)}...${address.slice(-4)}`
    return (
      <div className="flex items-center gap-4">
        <span className="wallet-address text-sm">{shortAddress}</span>
        <button
          onClick={() => disconnect()}
          className="btn btn-outline"
          style={{ padding: '0.4rem 0.8rem' }}
          title="Disconnect wallet"
        >
          <LogOut size={16} />
        </button>
      </div>
    )
  }

  // Find the generic injected connector
  const genericConnector = connectors.find((c) => c.name === 'Injected') || connectors[0];

  const isLoadingSession = isConnecting || isReconnecting;

  return (
    <div className="flex gap-2">
      <button
        onClick={() => genericConnector && connect({ connector: genericConnector })}
        className="btn btn-primary flex items-center gap-2"
        disabled={!genericConnector || isLoadingSession}
      >
        {isLoadingSession ? (
          <Loader2 className="animate-spin" size={18} />
        ) : (
          <Wallet size={18} />
        )}
        {isLoadingSession ? 'Connecting...' : 'Connect Wallet'}
      </button>
    </div>
  )
}
