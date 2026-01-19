module.exports = {
  apps: [
    {
      name: "alpr-backend",
      script: "node",             // CHANGED: Run node directly to avoid npm issues on Windows
      args: "server/index.js",
      cwd: "./",
      env: {
        NODE_ENV: "production",
        PORT: 3001
      }
    },
    {
      name: "alpr-ui-dev",
      script: "npm.cmd",          // CHANGED: Use npm.cmd for Windows compatibility
      args: "run dev",
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
