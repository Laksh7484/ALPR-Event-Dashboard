module.exports = {
  apps: [
    {
      name: "alpr-backend",
      script: "npm",
      args: "run server",
      cwd: "./",
      env: {
        NODE_ENV: "production",
        // PORT: 5001 // Default port from server/index.js
      }
    },
    {
      name: "alpr-ui",
      // USER: Update this if you use a specific proxy file or different command
      script: "npm",
      args: "run start",
      // If you use a specific node proxy file, uncomment and use this instead:
      // script: "node",
      // args: "path/to/your/proxy-file.js", 
    },
    {
      name: "ngrok-tunnel",
      // USER: Update the port if your server runs on a different one
      script: "ngrok",
      args: "http 5001 --log=stdout",
    }
  ]
};
