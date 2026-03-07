import { createConfig, http, cookieStorage, createStorage } from 'wagmi'
import { mainnet, flowTestnet } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'

export const config = createConfig({
  chains: [flowTestnet, mainnet],
  connectors: [
    injected(),
  ],
  ssr: true,
  storage: createStorage({
    storage: cookieStorage,
  }),
  transports: {
    [flowTestnet.id]: http(),
    [mainnet.id]: http(),
  },
})
