#!/usr/bin/env node

/**
 * Engine STT - Serviço separado para processamento de áudio e STT
 * 
 * Este serviço roda como subprocesso do Electron e expõe um WebSocket server
 * em 127.0.0.1:8787 para comunicação com o main process.
 */

import { createServer } from './server.js';
import { getLogger } from '@ricky/logger';

const logger = getLogger({ appName: 'ricky-engine' });

async function main() {
  try {
    logger.info('Starting Ricky Engine...');
    const server = await createServer(8787);
    logger.info('Ricky Engine started on port 8787');

    // Graceful shutdown
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, shutting down...');
      server.close();
      process.exit(0);
    });

    process.on('SIGINT', () => {
      logger.info('SIGINT received, shutting down...');
      server.close();
      process.exit(0);
    });
  } catch (error) {
    logger.fatal({ err: error }, 'Failed to start engine');
    process.exit(1);
  }
}

main();
