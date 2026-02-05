/**
 * Global Setup for Integration Tests
 * Starts the server before tests run
 */

import { spawn, ChildProcess } from "child_process";
import { setTimeout } from "timers/promises";

let serverProcess: ChildProcess | null = null;

export async function setup() {
  console.log("\n🚀 Starting server for integration tests...");
  
  // Start the server
  serverProcess = spawn("npx", ["tsx", "server/index.ts"], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      NODE_ENV: "test",
    },
    detached: false,
  });

  // Wait for server to be ready
  const maxWait = 30000; // 30 seconds
  const pollInterval = 500;
  let waited = 0;
  
  while (waited < maxWait) {
    try {
      const response = await fetch("http://localhost:3001/api/pipeline/task-lists");
      if (response.ok || response.status === 401) {
        console.log("✅ Server is ready");
        return;
      }
    } catch {
      // Server not ready yet
    }
    
    await setTimeout(pollInterval);
    waited += pollInterval;
  }

  throw new Error("Server failed to start within 30 seconds");
}

export async function teardown() {
  if (serverProcess) {
    console.log("\n🛑 Stopping server...");
    serverProcess.kill("SIGTERM");
    serverProcess = null;
  }
}
