import fs from 'fs/promises';
import path from 'path';

const DEFAULT_CONFIG_PATH = path.join(process.cwd(), 'config/config.json');

export function getConfigPath() {
  return DEFAULT_CONFIG_PATH;
}

export async function loadConfig(configPath = DEFAULT_CONFIG_PATH) {
  const data = await fs.readFile(configPath, 'utf-8');
  return JSON.parse(data);
}

export async function saveConfig(config, configPath = DEFAULT_CONFIG_PATH) {
  await fs.writeFile(configPath, JSON.stringify(config, null, 2));
}
