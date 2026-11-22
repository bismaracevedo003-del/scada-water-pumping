export async function createRepository(config, dbConfigured) {
  if (dbConfigured) {
    const { MysqlRepository } = await import('./mysql-repository.js');
    return new MysqlRepository(config.db);
  }
  const { InMemoryRepository } = await import('./in-memory-repository.js');
  return new InMemoryRepository();
}
