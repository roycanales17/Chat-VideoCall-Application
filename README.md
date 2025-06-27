## Chat & Video Call System

This project is a peer-to-peer (P2P) chat and video call demo built with modern web technologies, including `Socket.IO` and `Node.js`. It showcases real-time communication between users without the need for a centralized server.

## Prerequisites
Before running the application, make sure the following packages are installed. You may need to use `sudo` depending on your system permissions.
```cli
npm install
npm install --save-dev concurrently
npm install -g http-server 
```

## Serve the Application
Start both the backend server and the frontend with HTTPS support using:
```cli
npm run serve
```
This command:
- Runs the Node.js backend (`server.js`)
- Serves the frontend via `http-server` over HTTPS using a self-signed SSL certificate

**Note: The SSL certificates provided are self-signed and should only be used for local development or testing purposes. Browsers may display a warning that you'll need to manually bypass.**