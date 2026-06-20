/**
 * Dispense (pay out) banknotes from the payout store.
 *
 * Pays out a given number of notes of a given nominal. The `dispense_note`
 * event fires once the payout completes.
 *
 * Run with Babel:
 *   ESSP_DEVICE=/dev/ttyACM0 NOMINAL=100 COUNT=1 \
 *     npx babel-node examples/dispense-note.js
 *
 * NOTE: requires a real device with notes stored in the payout. This will
 * physically dispense cash — use with care.
 */
import SMARTPAYOUT from '../module_smartpayout';

const DEVICE = process.env.ESSP_DEVICE || '/dev/ttyACM0';
const TYPE = process.env.ESSP_TYPE || 'SMARTPayout';
const NOMINAL = parseInt(process.env.NOMINAL || '100', 10); // note value
const COUNT = parseInt(process.env.COUNT || '1', 10); // how many notes

const payout = new SMARTPAYOUT();

payout.on('dispense_note', ({ note_nominal, note_number }) => {
  console.log(`Dispensed: ${note_number} x ${note_nominal}`);
});

payout.on('error', err => console.error('Device error:', err));

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  payout.initialize({ device: DEVICE, type: TYPE });
  await wait(500);

  await payout.Init();

  // getSetup() is required: dispenseNote() uses the currency code and
  // value multiplier from the device setup.
  await payout.getSetup();

  console.log(`Dispensing ${COUNT} note(s) of ${NOMINAL} ...`);
  // dispenseNote expects [nominal, count].
  await payout.dispenseNote([NOMINAL, COUNT]);

  // Poll the device until the payout completes.
  await payout.pool();

  await payout.all_disable();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
