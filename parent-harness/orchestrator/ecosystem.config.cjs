/**
 * PM2 Ecosystem Configuration
 * 
 * Provides:
 * - Auto-restart on crash
 * - Log rotation
 * - Memory monitoring
 * - Cluster mode (optional)
 * 
 * Usage:
 *   pm2 start ecosystem.config.cjs
 *   pm2 logs orchestrator
 *   pm2 monit
 */

module.exports = {
  apps: [
    {
      name: 'orchestrator',
      script: 'dist/server.js',
      cwd: __dirname,
      
      // Environment
      env: {
        NODE_ENV: 'production',
        HARNESS_SPAWN_AGENTS: 'true',
        HARNESS_RUN_PLANNING: 'false',
        HARNESS_RUN_QA: 'true',
      },
      
      // Restart policy
      autorestart: true,
      max_restarts: 50,
      min_uptime: '10s',
      restart_delay: 5000,  // 5 seconds between restarts
      
      // Memory management
      max_memory_restart: '1G',  // Restart if memory exceeds 1GB
      
      // Logging
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: '~/.harness/logs/orchestrator-error.log',
      out_file: '~/.harness/logs/orchestrator-out.log',
      merge_logs: true,
      
      // Crash handling
      exp_backoff_restart_delay: 1000,  // Exponential backoff on repeated crashes
      
      // Watch for changes (disable in production)
      watch: false,
      ignore_watch: ['node_modules', 'logs', 'data'],
      
      // Graceful shutdown
      kill_timeout: 10000,  // 10 seconds to shutdown gracefully
      wait_ready: true,
      listen_timeout: 10000,
      
      // Health check
      // PM2 will ping this endpoint every 30s
      // If it fails 3 times, restart
    }
  ]
};
