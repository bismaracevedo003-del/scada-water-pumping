import { createAdapter } from './adapters/index.js';
import { createApp } from './app.js';
import { config, dbConfigured } from './config.js';
import { createRepository } from './repositories/index.js';

async function main() {
  const adapter = await createAdapter(config).then((instance) => instance.connect());
  const repository = await createRepository(config, dbConfigured).then((instance) => instance.init());
  const service = createApp({ adapter, repository, config });

  service.server.listen(config.port, () => {
    console.log(`SCADA API listening on http://127.0.0.1:${config.port}`);
    console.log(`PLC source: ${config.plcSource} | Repository: ${repository.constructor.name}`);
  });
  service.startPolling();

  const shutdown = async () => {
    service.stopPolling();
    service.server.close();
    adapter.close();
    await repository.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
