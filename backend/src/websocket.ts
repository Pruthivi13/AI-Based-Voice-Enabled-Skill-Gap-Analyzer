import { WebSocketServer } from 'ws';
import WebSocket from 'ws';
import { Server } from 'http';
import { env } from './config/env';
import { logger } from './utils/logger';
import admin from './config/firebaseAdmin';

const mlWsBaseUrl = env.ML_SERVICE_URL.replace(/^http/i, 'ws').replace(/\/$/, '');

const unauthorized = (socket: any) => {
  try {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
  } catch {}
  socket.destroy();
};

export function setupWebSocket(server: Server) {
  // No path filter — handle all WebSocket upgrades manually
  const wss = new WebSocketServer({ noServer: true });

  // Intercept HTTP upgrade requests
  server.on('upgrade', (req, socket, head) => {
    void (async () => {
      const url = new URL(req.url || '', 'http://localhost');
      if (!url.pathname.startsWith('/ws/transcribe/')) {
        socket.destroy();
        return;
      }

      const token = url.searchParams.get('token');
      if (!token) {
        unauthorized(socket);
        return;
      }

      try {
        await admin.auth().verifyIdToken(token);
      } catch (err) {
        logger.warn('Rejected unauthenticated WebSocket upgrade:', err);
        unauthorized(socket);
        return;
      }

      wss.handleUpgrade(req, socket, head, (clientWs) => {
        wss.emit('connection', clientWs, req);
      });
    })();
  });

  wss.on('connection', (clientWs, req) => {
    const url = new URL(req.url || '', 'http://localhost');
    const responseId = url.pathname.split('/').pop();
    logger.info(`WebSocket proxy connected for response: ${responseId}`);

    let mlWs: WebSocket;
    try {
      mlWs = new WebSocket(
        `${mlWsBaseUrl}/ws/transcribe/${encodeURIComponent(responseId || '')}`
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
