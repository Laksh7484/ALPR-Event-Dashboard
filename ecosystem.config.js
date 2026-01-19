module.exports = {
  apps: [
    {
      name: "alpr-backend",
      script: "npm",
      args: "run server",
      cwd: "./",
      env: {
        NODE_ENV: "production",
        PORT: 3001 // Confirmed from screenshot
      }
    },
    {
      name: "alpr-ui-dev",
      script: "npm",
      args: "run dev", // Runs 'ng serve' on port 3000
      cwd: "./"
    },
    {
      name: "https-proxy",
      script: "node",
      args: "proxy443.js", // Confirmed filename from screenshot
      cwd: "./"
    },
    {
      name: "ngrok-tunnel",
      script: "ngrok",
      args: "http 3001 --log=stdout", // Tunnels backend port 3001
      cwd: "./"
    }
  ]
};
