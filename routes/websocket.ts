/**
 * WebSocket Server Setup
 * Handles real-time communication with clients
 */
import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";

/**
 * WebSocket client management
 */
let clients = new Set<WebSocket>();

/**
 * Initialize WebSocket server
 */
export function websocketServer(httpServer: Server): WebSocketServer {
  const wss = new WebSocketServer({ 
    server: httpServer, 
    path: '/ws' 
  });
  
  wss.on('connection', (ws) => {
    clients.add(ws);
    console.log('✅ WebSocket client connected. Total clients:', clients.size);
    
    // Send welcome message
    ws.send(JSON.stringify({
      type: 'connection',
      message: 'Connected to Proud Profits WebSocket',
      timestamp: new Date().toISOString()
    }));
    
    ws.on('close', () => {
      clients.delete(ws);
      console.log('❌ WebSocket client disconnected. Total clients:', clients.size);
    });
    
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      clients.delete(ws);
    });

    // Handle incoming messages
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        console.log('📨 WebSocket message received:', message.type);
        
        // Echo back or process message
        switch (message.type) {
          case 'ping':
            ws.send(JSON.stringify({
              type: 'pong',
              timestamp: new Date().toISOString()
            }));
            break;
            
          case 'subscribe':
            // Handle subscription to specific data feeds
            console.log('📡 Client subscribed to:', message.feed);
            break;
            
          default:
            console.log('Unknown message type:', message.type);
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    });
  });
  
  return wss;
}

/**
 * Broadcast message to all connected clients
 */
export function broadcast(wss: WebSocketServer, message: any): void {
  const data = JSON.stringify({
    ...message,
    timestamp: new Date().toISOString()
  });
  
  let sent = 0;
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
      sent++;
    } else {
      // Remove closed connections
      clients.delete(client);
    }
  });
  
  if (sent > 0) {
    console.log(`📡 Broadcasted ${message.type} to ${sent} clients`);
  }
}

/**
 * Send message to specific client
 */
export function sendToClient(client: WebSocket, message: any): boolean {
  if (client.readyState === WebSocket.OPEN) {
    client.send(JSON.stringify({
      ...message,
      timestamp: new Date().toISOString()
    }));
    return true;
  }
  return false;
}

/**
 * Get WebSocket statistics
 */
export function getWebSocketStats() {
  return {
    totalClients: clients.size,
    activeClients: Array.from(clients).filter(
      client => client.readyState === WebSocket.OPEN
    ).length
  };
}