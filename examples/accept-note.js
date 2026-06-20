/**
 * Accept (take in) banknotes.
 *
 * Enables the validator for the device's own currency and runs the poll
 * loop. When a note is credited, the `take_note` event fires with the
 * note nominal.
 *
 * Run with Babel:
 *   ESSP_DEVICE=/dev/ttyACM0 npx babel-node examples/accept-note.js
 *
 * NOTE: requires a real device. Inserting a note will accept it.
 */
import SMARTPAYOUT from '../module_smartpayout';

const DEVICE = process.env.ESSP_DEVICE || '/dev/ttyACM0';
const TYPE = process.env.ESSP_TYPE || 'SMARTPayout';

const payout = new SMARTPAYOUT();

payout.on('take_note', ({ note_nominal, note_number }) => {
  console.log(`Accepted note: ${note_nominal} (channel ${note_number})`);
});

payout.on('error', err => console.error('Device error:', err));

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  payout.initialize({ device: DEVICE, type: TYPE });
  await wait(500);

  await payout.Init();

  // Read setup so we know which currency codes to accept.
  const setup = await payout.getSetup();
  console.log('Accepting currency:', setup.currency);

  // Enable acceptance for the device's currency.
  await payout.takeNote(setup.currency_code);

  // Poll the device while the transaction is active.
  // `pool()` returns once a note is taken (it clears the pool flag).
  await payout.pool();

  await payout.all_disable();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
