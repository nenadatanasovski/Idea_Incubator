module.exports = {
  apps: [
    {
      name: 'orchestrator',
      script: 'npx',
      args: 'tsx src/server.ts',
      cwd: __dirname,
      env: {
        NODE_ENV: 'production',
        HARNESS_RUNTIME_MODE: 'event',
        HARNESS_EVENT_SYSTEM: 'true',
        HARNESS_SPAWN_AGENTS: 'true',
        HARNESS_RUN_PLANNING: 'true',
        PORT: '3333',
      },
      // Restart policy
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 2000,
      
      // Logging
      error_file: '/tmp/orchestrator-error.log',
      out_file: '/tmp/orchestrator-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      
      // Watch for crashes
      watch: false,
      ignore_watch: ['node_modules', 'dist', '*.log'],
      
      // Memory limit - restart if exceeded
      max_memory_restart: '1G',
    },
  ],
};
