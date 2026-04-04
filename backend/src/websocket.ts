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

    let mlWs: WebSocket;
    try {
      mlWs = new WebSocket(
        `ws://localhost:8000/ws/transcribe/${responseId}`
      );
    } catch (err) {
      logger.error('Failed to connect to ML WebSocket:', err);
      clientWs.send(JSON.stringify({ type: 'error', message: 'ML service unavailable' }));
      clientWs.close();
      return;
    }

    mlWs.on('open', () => {
      logger.info(`ML WebSocket established for: ${responseId}`);
    });

    clientWs.on('message', (data, isBinary) => {
      if (mlWs.readyState === WebSocket.OPEN) {
        if (isBinary) {
          mlWs.send(data);
        } else {
          // Forward text frames (like 'END') as text
          mlWs.send(data.toString());
        }
      }
    });

    mlWs.on('message', (data, isBinary) => {
      if (clientWs.readyState === WebSocket.OPEN) {
        // ML sends JSON text messages — forward as text, not binary
        clientWs.send(isBinary ? data : data.toString());
      }
    });

    mlWs.on('error', (err) => {
      logger.error('ML WebSocket error:', err);
      try {
        clientWs.send(JSON.stringify({ type: 'error', message: 'Transcription service error' }));
      } catch {}
      try { clientWs.close(); } catch {}
    });

    clientWs.on('error', (err) => {
      logger.error('Client WebSocket error:', err);
      try { mlWs.close(); } catch {}
    });

    clientWs.on('close', () => {
      if (mlWs.readyState === WebSocket.OPEN) {
        try { mlWs.close(); } catch {}
      }
    });

    mlWs.on('close', () => {
      // Small delay so the final message is flushed to the client
      setTimeout(() => {
        if (clientWs.readyState === WebSocket.OPEN) {
          try { clientWs.close(); } catch {}
        }
      }, 500);
    });
  });

  logger.info('WebSocket proxy ready at /ws/transcribe');
}
