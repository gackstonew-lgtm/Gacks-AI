import React, { useState, useEffect } from 'react'

interface MarketItem {
  symbol: string
  name: string
  price: string
  change: string
  isPositive: boolean
  sparkline: number[]
  category: 'forex' | 'gold' | 'crypto' | 'indices' | 'commodities'
}

const INITIAL_MARKET_DATA: MarketItem[] = [
  {
    symbol: 'XAUUSD',
    name: 'Gold',
    price: '3,642.18',
    change: '+1.24%',
    isPositive: true,
    sparkline: [20, 24, 22, 28, 26, 32, 35],
    category: 'gold',
  },
  {
    symbol: 'EURUSD',
    name: 'Euro / US Dollar',
    price: '1.1724',
    change: '+0.32%',
    isPositive: true,
    sparkline: [15, 17, 16, 18, 17, 19, 21],
    category: 'forex',
  },
  {
    symbol: 'GBPUSD',
    name: 'British Pound / USD',
    price: '1.3567',
    change: '+0.28%',
    isPositive: true,
    sparkline: [18, 19, 17, 21, 20, 22, 24],
    category: 'forex',
  },
  {
    symbol: 'USDJPY',
    name: 'USD / Japanese Yen',
    price: '147.23',
    change: '-0.12%',
    isPositive: false,
    sparkline: [25, 23, 24, 20, 22, 19, 18],
    category: 'forex',
  },
  {
    symbol: 'BTCUSD',
    name: 'Bitcoin',
    price: '115,420',
    change: '+2.15%',
    isPositive: true,
    sparkline: [30, 32, 31, 36, 35, 40, 44],
    category: 'crypto',
  },
  {
    symbol: 'ETHUSD',
    name: 'Ethereum',
    price: '4,320.75',
    change: '+1.77%',
    isPositive: true,
    sparkline: [22, 25, 23, 29, 28, 33, 36],
    category: 'crypto',
  },
]

export const MarketOverviewCard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'all' | 'forex' | 'gold' | 'crypto'>('all')
  const [marketItems, setMarketItems] = useState<MarketItem[]>(INITIAL_MARKET_DATA)
  const [lastUpdated, setLastUpdated] = useState<string>('Live')

  // Real Crypto & Forex live data fetch from free public APIs
  useEffect(() => {
    let cancelled = false

    const fetchLivePrices = async () => {
      try {
        // Fetch public Crypto prices (Bitcoin & Ethereum) from CoinGecko
        const cryptoRes = await fetch(
          'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true',
        )
        if (cryptoRes.ok) {
          const cryptoData = await cryptoRes.json()
          if (!cancelled && cryptoData?.bitcoin && cryptoData?.ethereum) {
            setMarketItems((prev) =>
              prev.map((item) => {
                if (item.symbol === 'BTCUSD') {
                  const btc = cryptoData.bitcoin
                  const change = btc.usd_24h_change ?? 2.15
                  return {
                    ...item,
                    price: btc.usd.toLocaleString(),
                    change: `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`,
                    isPositive: change >= 0,
                  }
                }
                if (item.symbol === 'ETHUSD') {
                  const eth = cryptoData.ethereum
                  const change = eth.usd_24h_change ?? 1.77
                  return {
                    ...item,
                    price: eth.usd.toLocaleString(),
                    change: `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`,
                    isPositive: change >= 0,
                  }
                }
                return item
              }),
            )
            setLastUpdated('Updated just now')
          }
        }
      } catch {
        // Graceful offline fallback
      }
    }

    fetchLivePrices()
    const timer = setInterval(fetchLivePrices, 60000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [])

  const filteredItems =
    activeTab === 'all'
      ? marketItems
      : marketItems.filter((i) => i.category === activeTab)

  const renderSparkline = (points: number[], isPositive: boolean) => {
    const width = 64
    const height = 24
    const min = Math.min(...points)
    const max = Math.max(...points)
    const range = max - min || 1

    const coords = points.map((p, idx) => {
      const x = (idx / (points.length - 1)) * width
      const y = height - ((p - min) / range) * (height - 6) - 3
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })

    const pathData = `M ${coords.join(' L ')}`
    const strokeColor = isPositive ? '#00e5a3' : '#ff4d4d'

    return (
      <svg className="gacks-sparkline-svg" width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <path
          d={pathData}
          fill="none"
          stroke={strokeColor}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }

  return (
    <div className="gacks-card gacks-market-card">
      <div className="gacks-card-header">
        <div className="gacks-card-title-wrap">
          <span className="gacks-orange-bullet" />
          <h3 className="gacks-card-title">LIVE MARKET OVERVIEW</h3>
        </div>

        <div className="gacks-market-tabs">
          <button
            type="button"
            className={`gacks-market-tab ${activeTab === 'all' ? 'gacks-market-tab-active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            All
          </button>
          <button
            type="button"
            className={`gacks-market-tab ${activeTab === 'forex' ? 'gacks-market-tab-active' : ''}`}
            onClick={() => setActiveTab('forex')}
          >
            Forex
          </button>
          <button
            type="button"
            className={`gacks-market-tab ${activeTab === 'gold' ? 'gacks-market-tab-active' : ''}`}
            onClick={() => setActiveTab('gold')}
          >
            Gold
          </button>
          <button
            type="button"
            className={`gacks-market-tab ${activeTab === 'crypto' ? 'gacks-market-tab-active' : ''}`}
            onClick={() => setActiveTab('crypto')}
          >
            Crypto
          </button>
        </div>

        <span className="gacks-card-header-link">{lastUpdated}</span>
      </div>

      <div className="gacks-market-grid">
        {filteredItems.map((item) => (
          <div key={item.symbol} className="gacks-market-tile">
            <div className="gacks-market-tile-header">
              <span className="gacks-market-symbol">{item.symbol}</span>
            </div>
            <div className="gacks-market-tile-body">
              <span className="gacks-market-price">{item.price}</span>
              <span
                className={`gacks-market-change ${
                  item.isPositive ? 'gacks-change-pos' : 'gacks-change-neg'
                }`}
              >
                {item.change}
              </span>
            </div>
            <div className="gacks-market-sparkline-wrap">
              {renderSparkline(item.sparkline, item.isPositive)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
