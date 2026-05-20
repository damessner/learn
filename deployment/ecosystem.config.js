module.exports = {
  apps: [
    {
      name: 'learnflow-backend',
      script: './server.js',
      cwd: '/var/www/learnflow/backend',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        DB_PATH: './db/learnflow.db'
      }
    }
  ]
};
