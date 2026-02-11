import { useState, useEffect, useCallback } from "react";

const API_BASE = "http://localhost:3333";

export function ServerToggle() {
  const [online, setOnline] = useState(false);
  const [toggling, setToggling] = useState(false);

  const checkStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/orchestrator/status`);
      if (res.ok) {
        const data = await res.json();
        setOnline(data.running === true);
      } else {
        setOnline(false);
      }
    } catch {
      setOnline(false);
    }
  }, []);

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 3000);
    return () => clearInterval(interval);
  }, [checkStatus]);

  const toggle = async () => {
    setToggling(true);
    try {
      // Use pause/resume endpoints from orchestrator API
      const endpoint = online
        ? `${API_BASE}/api/orchestrator/pause`
        : `${API_BASE}/api/orchestrator/resume`;

      await fetch(endpoint, { method: "POST" });

      // Poll a few times to confirm the state change
      for (let i = 0; i < 4; i++) {
        await new Promise((r) => setTimeout(r, 1000));
        await checkStatus();
      }
    } catch (err) {
      console.error("Toggle error:", err);
      await checkStatus();
    } finally {
      setToggling(false);
    }
  };

  return (
    <button
      onClick={toggle}
      disabled={toggling}
      className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer select-none ${
        toggling
          ? "bg-gray-700 text-gray-400"
          : online
            ? "bg-green-900/40 text-green-400 hover:bg-red-900/40 hover:text-red-400"
            : "bg-gray-700 text-gray-400 hover:bg-green-900/40 hover:text-green-400"
      }`}
      title={
        online ? "Click to pause orchestrator" : "Click to resume orchestrator"
      }
    >
      <span
        className={`w-2 h-2 rounded-full transition-colors ${
          toggling
            ? "bg-yellow-500 animate-pulse"
            : online
              ? "bg-green-500"
              : "bg-red-500"
        }`}
      />
      {toggling
        ? online
          ? "Pausing..."
          : "Resuming..."
        : online
          ? "Running"
          : "Paused"}
    </button>
  );
}
