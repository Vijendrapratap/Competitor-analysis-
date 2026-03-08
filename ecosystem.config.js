// =============================================================================
// PM2 Ecosystem Configuration — Competitor Intelligence System
// =============================================================================
// Usage:
//   pm2 start ecosystem.config.js
//   pm2 start ecosystem.config.js --only competitor-intel
//   pm2 logs competitor-intel
//   pm2 monit
// =============================================================================

module.exports = {
  apps: [
    {
      // ── Main scheduler process ───────────────────────────────────────────
      name: 'competitor-intel',
      script: 'src/scheduler.ts',
      interpreter: 'node',
      interpreter_args: '--import tsx/esm',

      // Auto-restart on crash
      autorestart: true,
      watch: false,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 5000,

      // Memory limit — restart if exceeded
      max_memory_restart: '1G',

      // Instances
      instances: 1,
      exec_mode: 'fork',

      // Logging
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      merge_logs: true,
      log_type: 'json',

      // Environment variables (defaults — override with .env or --env)
      env: {
        NODE_ENV: 'production',
        HEALTH_PORT: '3000',
      },
      env_development: {
        NODE_ENV: 'development',
        LOG_LEVEL: 'debug',
        HEALTH_PORT: '3001',
      },

      // Graceful shutdown
      kill_timeout: 300000, // 5 minutes — wait for running pipeline
      listen_timeout: 10000,
      shutdown_with_message: true,

      // Cron-based restart (restart process daily at 22:00 UTC to clear memory)
      cron_restart: '0 22 * * *',
    },

    {
      // ── One-shot pipeline runner (for manual/cron triggers) ──────────────
      name: 'competitor-intel-run',
      script: 'src/index.ts',
      interpreter: 'node',
      interpreter_args: '--import tsx/esm',
      args: 'run',

      // Don't auto-restart — this is a one-shot job
      autorestart: false,
      watch: false,

      max_memory_restart: '1G',
      instances: 1,
      exec_mode: 'fork',

      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: './logs/pm2-run-error.log',
      out_file: './logs/pm2-run-out.log',
      merge_logs: true,

      env: {
        NODE_ENV: 'production',
      },

      // Give the full pipeline time to complete
      kill_timeout: 600000, // 10 minutes
    },
  ],
};
