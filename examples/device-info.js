/**
 * Safest example to run first: it only reads information from the device
 * (serial number, setup, stored note levels). It does NOT accept or
 * dispense any notes.
 *
 * Run with Babel:
 *   ESSP_DEVICE=/dev/ttyACM0 npx babel-node examples/device-info.js
 *
 * NOTE: requires a real device connected to the given serial port.
 */
import SMARTPAYOUT from '../module_smartpayout';

const DEVICE = process.env.ESSP_DEVICE || '/dev/ttyACM0';
const TYPE = process.env.ESSP_TYPE || 'SMARTPayout';

const payout = new SMARTPAYOUT();

payout.on('error', err => console.error('Device error:', err));

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  payout.initialize({ device: DEVICE, type: TYPE });

  // Give the serial port a moment to open before talking to the device.
  await wait(500);

  // Establish the encrypted link and switch to protocol v6.
  await payout.Init();

  const serial = await payout.getSerialNumber();
  console.log('Serial number:', serial);

  const setup = await payout.getSetup();
  console.log('Currency:', setup.currency);
  console.log('Firmware:', setup.firmwareVersion);
  console.log('Channels:', setup.channelsCount);
  console.log('Denominations:', setup.channelDenomination);

  const levels = await payout.getAllLevels();
  console.log('Stored note levels:', levels);

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
