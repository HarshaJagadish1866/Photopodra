module.exports = {
  apps: [
    {
      name: 'photopodra-server',
      script: 'backend/src/index.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '2G',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        ALLOWED_ORIGINS: '*'
      }
    }
  ]
};
