## Chat & Video Call System

This project is a peer-to-peer (P2P) chat and video call application built using modern web technologies. It allows users to communicate in real time without relying on a centralized server, ensuring secure and private conversations.

## Prerequisites
Install the required global package:
```cli
npm install
npm install -g http-server 
```

## Run the Socket Server
Start the WebSocket server:
```cli
node server.js
```

## Serve the Application
Serve the frontend with a self-signed SSL certificate:
```cli
http-server . -p 3000 -a 0.0.0.0 --ssl --cert certs/localhost.pem --key certs/localhost-key.pem
```
**Note: The certificates used here are self-signed and intended for development/testing purposes only.**