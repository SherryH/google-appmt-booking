/**
 * Test: Jump to Next Bookable Date Scenario
 *
 * This test verifies the scraper correctly handles the case when
 * no slots are available in the current view and a "Jump to next
 * bookable date" link appears.
 */

import { GoogleCalendarScraper } from './src/scraper.js';

const scraper = new GoogleCalendarScraper({
  headless: false,
  debug: true,
  maxWeeks: 4
});

async function testJumpScenario() {
  console.log('=== FULL TEST: Jump to Next Bookable Date ===\n');

  await scraper.init();

  const url = 'https://calendar.google.com/calendar/u/0/appointments/schedules/AcZssZ0LGgL6SkjqOQUO09O-_RRM2BbFrwq5o5_fgs_VvnFeIx_26OfOFoaAF8Hd0qnAuY3kuS3PuuFB';

  console.log('STEP 1: Navigate to booking page');
  await scraper.page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });

  // Get initial slot count
  let slotCount = await scraper.page.evaluate(() =>
    document.querySelectorAll('button[data-date-time]').length
  );
  console.log('   Initial slots visible:', slotCount);
  await scraper.page.screenshot({ path: 'jump-test-1-initial.png', fullPage: true });

  console.log('\nSTEP 2: Navigate to a date with NO availability');
  const clickedDate = await scraper.page.evaluate(() => {
    const dateCells = document.querySelectorAll('td[data-date] button');
    for (const btn of dateCells) {
      const label = btn.getAttribute('aria-label') || '';
      if (label.includes('no available times')) {
        btn.click();
        return label;
      }
    }
    return null;
  });

  if (clickedDate) {
    console.log('   Clicked:', clickedDate);
    await new Promise(r => setTimeout(r, 2000));
  } else {
    console.log('   ERROR: No unavailable date found!');
    await scraper.close();
    return;
  }

  // Check state after clicking unavailable date
  slotCount = await scraper.page.evaluate(() =>
    document.querySelectorAll('button[data-date-time]').length
  );
  const hasJump = await scraper.page.evaluate(() =>
    document.body.innerText.toLowerCase().includes('jump to')
  );

  console.log('   Slots visible now:', slotCount);
  console.log('   Jump link visible:', hasJump);
  await scraper.page.screenshot({ path: 'jump-test-2-no-slots.png', fullPage: true });

  if (!hasJump) {
    console.log('\n   ERROR: Jump link not visible!');
    await scraper.close();
    return;
  }

  console.log('\nSTEP 3: Click "Jump to next bookable date"');
  const jumped = await scraper.tryJumpToNextDate();
  console.log('   Jump successful:', jumped);

  await new Promise(r => setTimeout(r, 2000));
  await scraper.page.screenshot({ path: 'jump-test-3-after-jump.png', fullPage: true });

  // Check slots after jumping
  const afterJumpInfo = await scraper.page.evaluate(() => {
    const slots = document.querySelectorAll('button[data-date-time]');
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const slotList = [];

    slots.forEach(btn => {
      const ts = parseInt(btn.getAttribute('data-date-time'));
      if (ts) {
        const d = new Date(ts);
        slotList.push(dayNames[d.getDay()] + ' ' + btn.textContent?.trim());
      }
    });

    return {
      slotCount: slots.length,
      sampleSlots: slotList.slice(0, 5)
    };
  });

  console.log('\nSTEP 4: Verify slots found after jump');
  console.log('   Slots found:', afterJumpInfo.slotCount);
  console.log('   Sample slots:', afterJumpInfo.sampleSlots.join(', '));

  console.log('\n========================================');
  console.log('=== TEST RESULT ===');
  console.log('========================================');

  if (jumped && afterJumpInfo.slotCount > 0) {
    console.log('✅ SUCCESS: Jump to next bookable date WORKS!');
    console.log('   - Started on date with no availability');
    console.log('   - Jump link was clicked');
    console.log('   - Slots found after jumping:', afterJumpInfo.slotCount);
  } else {
    console.log('❌ FAILED: Jump did not work as expected');
    console.log('   jumped:', jumped);
    console.log('   slots after:', afterJumpInfo.slotCount);
  }

  console.log('\nScreenshots saved:');
  console.log('   - jump-test-1-initial.png');
  console.log('   - jump-test-2-no-slots.png');
  console.log('   - jump-test-3-after-jump.png');

  await scraper.close();
}

testJumpScenario().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
