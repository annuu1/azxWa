module.exports = {
  apps: [
    {
      name: 'autozonex-connect',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 9091',
      cwd: '/home/administrator/azxWa',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: '9091',
      },
    },
  ],
};
