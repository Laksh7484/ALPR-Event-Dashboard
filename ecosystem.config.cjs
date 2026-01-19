module.exports = {
  apps: [
    {
      name: "alpr-backend",
      script: "node",
      args: "server/index.js",
      cwd: "./",
      env: {
        NODE_ENV: "production",
        PORT: 3001
      }
    },
    {
      name: "alpr-ui-dev",
      script: "node",             // CHANGED: Run ng.js directly via node
      args: "node_modules/@angular/cli/bin/ng.js serve",
      cwd: "./"
    },
    {
      name: "https-proxy",
      script: "node",
      args: "proxy443.js",
      cwd: "./"
    },
    {
      name: "ngrok-tunnel",
      script: "ngrok",
      args: "http 3001 --log=stdout",
      cwd: "./"
    }
  ]
};
