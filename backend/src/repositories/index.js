export async function createRepository(config, dbConfigured) {
  const mode = (config.mode || 'simulation').toLowerCase();
  if (!['simulation', 'real'].includes(mode)) {
    throw new Error(`Unsupported MODE: ${mode} (use simulation or real)`);
  }

  if (mode === 'real') {
    if (config.dbDriver !== 'mysql') {
      throw new Error(
        `MODE=real requires DB_DRIVER=mysql, got ${config.dbDriver}. ` +
        'Real mode never falls back to the in-memory repository.',
      );
    }
    if (!dbConfigured) {
      throw new Error('MODE=real requires DB_HOST, DB_USER, DB_PASSWORD and DB_NAME');
    }
    const { MysqlRepository } = await import('./mysql-repository.js');
    return new MysqlRepository(config.db);
  }

  if (dbConfigured) {
    const { MysqlRepository } = await import('./mysql-repository.js');
    return new MysqlRepository(config.db);
  }
  const { InMemoryRepository } = await import('./in-memory-repository.js');
  return new InMemoryRepository();
}
