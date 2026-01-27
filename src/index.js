import { loadConfig, saveConfig } from './config.js';
import { BookingService } from './booking-service.js';
import {
  initNotifier,
  sendBookingSuccess,
  sendBookingFailure,
  shouldNotifyFailure
} from './notifier.js';
import readline from 'readline';

const COMMANDS = {
  activate: activateJob,
  deactivate: deactivateJob,
  status: showStatus,
  book: runBooking,
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
      case '4': await runBooking(); break;
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

async function runBooking() {
  const isDryRun = process.argv.includes('--dry-run');
  const useMock = process.argv.includes('--mock');

  console.log('\n🚀 Starting booking attempt...\n');

  const config = await loadConfig();

  if (!config.active && !process.argv.includes('--force')) {
    console.log('⚠️  Job is not active. Use --force to run anyway.');
    return;
  }

  // Initialize notifier
  initNotifier(process.env.RESEND_API_KEY);

  // Mock slots for testing
  const mockSlots = useMock ? [
    { text: 'Monday 9:00 AM', normalized: 'mon 9am' },
    { text: 'Tuesday 3:00 PM', normalized: 'tue 3pm' },
    { text: 'Wednesday 4:00 PM', normalized: 'wed 4pm' },
    { text: 'Thursday 2:00 PM', normalized: 'thu 2pm' },
    { text: 'Friday 11:00 AM', normalized: 'fri 11am' },
  ] : null;

  const service = new BookingService({ dryRun: isDryRun || useMock });

  try {
    const result = await service.attemptBooking(config, mockSlots);

    if (result.success) {
      console.log(`\n🎉 SUCCESS! ${result.dryRun ? '(DRY RUN) Would book' : 'Booked'}: ${result.slot.text}`);
      config.consecutive_failures = 0;

      // Send success email
      if (!result.dryRun) {
        await sendBookingSuccess(config.email, result.slot);
      }

    } else {
      config.consecutive_failures += 1;
      console.log(`\n❌ Booking failed: ${result.reason}`);
      console.log(`   Consecutive failures: ${config.consecutive_failures}`);

      if (result.availableSlots?.length > 0) {
        console.log(`   Available slots: ${result.availableSlots.join(', ')}`);
      }

      // Send failure email if threshold reached
      if (shouldNotifyFailure(config.consecutive_failures)) {
        await sendBookingFailure(
          config.email,
          result.reason,
          config.consecutive_failures,
          result.availableSlots
        );
      }
    }

    await saveConfig(config);

  } catch (error) {
    console.error(`\n💥 Error: ${error.message}`);
    config.consecutive_failures += 1;
    await saveConfig(config);

    if (shouldNotifyFailure(config.consecutive_failures)) {
      await sendBookingFailure(
        config.email,
        error.message,
        config.consecutive_failures,
        []
      );
    }
  }
}

main().catch(console.error);

export { runBooking };
