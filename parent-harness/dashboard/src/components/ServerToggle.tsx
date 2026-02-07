import { useState, useEffect, useCallback } from 'react'

export function ServerToggle() {
  const [online, setOnline] = useState(false)
  const [toggling, setToggling] = useState(false)

  const checkStatus = useCallback(async () => {
    try {
      const res = await fetch('/__server/status')
      const data = await res.json()
      setOnline(data.online)
    } catch {
      setOnline(false)
    }
  }, [])

  useEffect(() => {
    checkStatus()
    const interval = setInterval(checkStatus, 3000)
    return () => clearInterval(interval)
  }, [checkStatus])

  const toggle = async () => {
    setToggling(true)
    try {
      const endpoint = online ? '/__server/stop' : '/__server/start'
      await fetch(endpoint, { method: 'POST' })
      // Poll a few times to confirm the state change
      for (let i = 0; i < 4; i++) {
        await new Promise(r => setTimeout(r, 1000))
        await checkStatus()
      }
    } catch {
      await checkStatus()
    } finally {
      setToggling(false)
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={toggling}
      className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer select-none ${
        toggling
          ? 'bg-gray-700 text-gray-400'
          : online
            ? 'bg-green-900/40 text-green-400 hover:bg-red-900/40 hover:text-red-400'
            : 'bg-gray-700 text-gray-400 hover:bg-green-900/40 hover:text-green-400'
      }`}
      title={online ? 'Click to stop server' : 'Click to start server'}
    >
      <span className={`w-2 h-2 rounded-full transition-colors ${
        toggling
          ? 'bg-yellow-500 animate-pulse'
          : online
            ? 'bg-green-500'
            : 'bg-red-500'
      }`} />
      {toggling
        ? (online ? 'Stopping...' : 'Starting...')
        : online
          ? 'Server On'
          : 'Server Off'
      }
    </button>
  )
}
