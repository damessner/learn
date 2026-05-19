module.exports = {
  apps: [
    {
      name: 'learnflow-backend',
      script: './backend/server.js',
      cwd: '/var/www/learnflow',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        DB_PATH: './db/learnflow.db',
        JWT_SECRET: 'school-live-secret-key-change-me',
        BASE_URL: 'http://localhost'
      }
    }
  ]
};
