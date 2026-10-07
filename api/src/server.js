import 'dotenv/config';
import app from './app.js';
import { connectDatabase } from './config/database.js';
import { startAnalysisWorker } from './worker/analysisWorker.js';

const port = process.env.PORT || 3000;

async function startServer() {
  await connectDatabase();
  startAnalysisWorker();

  app.listen(port, '0.0.0.0', () => {
    console.log(`API listening on port ${port}`);
  });
}

startServer().catch((error) => {
  console.error('Unable to start API:', error.message);
  process.exit(1);
});
