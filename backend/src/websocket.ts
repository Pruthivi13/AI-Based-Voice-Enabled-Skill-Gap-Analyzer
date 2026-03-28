import { WebSocketServer } from 'ws';
import WebSocket from 'ws';
import { Server } from 'http';
import { logger } from './utils/logger';

export function setupWebSocket(server: Server) {
  // No path filter — handle all WebSocket upgrades manually
  const wss = new WebSocketServer({ noServer: true });

  // Intercept HTTP upgrade requests
  server.on('upgrade', (req, socket, head) => {
    if (req.url?.startsWith('/ws/transcribe/')) {
      wss.handleUpgrade(req, socket, head, (clientWs) => {
        wss.emit('connection', clientWs, req);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on('connection', (clientWs, req) => {
    const responseId = req.url?.split('/').pop();
    logger.info(`WebSocket proxy connected for response: ${responseId}`);

    const mlWs = new WebSocket(
      `ws://localhost:8000/ws/transcribe/${responseId}`
    );

    mlWs.on('open', () => {
      logger.info(`ML WebSocket established for: ${responseId}`);
    });

    clientWs.on('message', (data) => {
      if (mlWs.readyState === WebSocket.OPEN) mlWs.send(data);
    });

    mlWs.on('message', (data, isBinary) => {
      if (clientWs.readyState === WebSocket.OPEN) {
        // ML sends JSON text messages — forward as text, not binary
        clientWs.send(isBinary ? data : data.toString());
      }
    });

    mlWs.on('error', (err) => {
      logger.error('ML WebSocket error:', err);
      clientWs.close();
    });

    clientWs.on('error', (err) => {
      logger.error('Client WebSocket error:', err);
      mlWs.close();
    });

    clientWs.on('close', () => {
      if (mlWs.readyState === WebSocket.OPEN) mlWs.close();
    });

    mlWs.on('close', () => {
      // Small delay so the final message is flushed to the client
      setTimeout(() => {
        if (clientWs.readyState === WebSocket.OPEN) clientWs.close();
      }, 500);
    });
  });

  logger.info('WebSocket proxy ready at /ws/transcribe');
}
