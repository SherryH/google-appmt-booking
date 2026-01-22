import { loadConfig, saveConfig } from '../config.js';
import fs from 'fs/promises';
import path from 'path';

describe('Config Module', () => {
  const testConfigPath = path.join(process.cwd(), 'config/config.test.json');

  beforeEach(async () => {
    await fs.writeFile(testConfigPath, JSON.stringify({
      booking_url: "https://test.com",
      preferences: ["Mon 9am"],
      active: false,
      email: "test@test.com",
      consecutive_failures: 0
    }));
  });

  afterEach(async () => {
    try { await fs.unlink(testConfigPath); } catch (e) {}
  });

  test('loadConfig returns config object', async () => {
    const config = await loadConfig(testConfigPath);
    expect(config.booking_url).toBe("https://test.com");
    expect(config.preferences).toEqual(["Mon 9am"]);
    expect(config.active).toBe(false);
  });

  test('saveConfig persists changes', async () => {
    const config = await loadConfig(testConfigPath);
    config.active = true;
    await saveConfig(config, testConfigPath);

    const reloaded = await loadConfig(testConfigPath);
    expect(reloaded.active).toBe(true);
  });
});
