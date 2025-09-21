/**
 * WebSocket Utility Functions
 * Helper functions for WebSocket operations
 */
import { WebSocketServer, WebSocket } from "ws";

/**
 * Broadcast message to all connected clients
 */
export function broadcast(wss: WebSocketServer, message: any): void {
  const data = JSON.stringify({
    ...message,
    timestamp: new Date().toISOString()
  });
  
  let sent = 0;
  
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
      sent++;
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
 * Get connected clients count
 */
export function getClientCount(wss: WebSocketServer): number {
  return wss.clients.size;
}