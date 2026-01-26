import { loadConfig, saveConfig } from './config.js';
import readline from 'readline';

const COMMANDS = {
  activate: activateJob,
  deactivate: deactivateJob,
  status: showStatus,
  menu: showMenu,
};

async function main() {
  const command = process.argv[2];

  if (command && COMMANDS[command]) {
    await COMMANDS[command]();
  } else {
    await showMenu();
  }
}

async function showMenu() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log('\n📅 Therapist Appointment Booker\n');
  console.log('What would you like to do?');
  console.log('[1] Activate booking job');
  console.log('[2] Check status');
  console.log('[3] Deactivate booking job');
  console.log('[4] Run booking now');
  console.log('[5] Exit\n');

  rl.question('Enter choice: ', async (answer) => {
    rl.close();

    switch (answer) {
      case '1': await activateJob(); break;
      case '2': await showStatus(); break;
      case '3': await deactivateJob(); break;
      case '4': console.log('⚠️  Booking not implemented yet'); break;
      case '5': process.exit(0);
      default: console.log('Invalid choice');
    }
  });
}

async function activateJob() {
  const config = await loadConfig();
  config.active = true;
  config.consecutive_failures = 0;
  await saveConfig(config);
  console.log('✅ Booking job activated! Will attempt booking at midnight.');
}

async function deactivateJob() {
  const config = await loadConfig();
  config.active = false;
  await saveConfig(config);
  console.log('🛑 Booking job deactivated.');
}

async function showStatus() {
  const config = await loadConfig();
  console.log('\n📊 Current Status:');
  console.log(`   Active: ${config.active ? '✅ Yes' : '❌ No'}`);
  console.log(`   Booking URL: ${config.booking_url.substring(0, 50)}...`);
  console.log(`   Preferences: ${config.preferences.join(', ')}`);
  console.log(`   Email: ${config.email}`);
  console.log(`   Consecutive failures: ${config.consecutive_failures}\n`);
}

main().catch(console.error);
