# essp-smartpayout

A Node.js driver for **Innovative Technology** banknote validators / payout
units (SMART Payout, NV200, NV11) using the encrypted **eSSP** (Smiley Secure
Protocol) over a serial connection.

It handles the low-level protocol — packet framing, CRC16, sequence flags,
the eSSP key negotiation (Diffie-Hellman) and AES encryption of the link — and
exposes a high-level, event-driven API for accepting and dispensing notes.

> ⚠️ This library talks to real cash-handling hardware over a serial port.
> Test against a device you control, in a safe environment.

> 🧪 **Status:** the protocol logic is unchanged from production use, but the
> migration to `serialport` v13 has **not yet been verified on real hardware**.
> If you have a device, testing and feedback are very welcome. Pin an earlier
> version if you need the previously hardware-tested `serialport` v7 code path.

## Features

- Full eSSP encrypted-link setup (generator/modulus/key exchange, AES-ECB).
- Accept notes (`takeNote`) and dispense notes (`dispenseNote`).
- Query device state: serial number, setup/denominations, stored levels.
- Note routing (payout store vs. cashbox).
- Rich event stream for every device status (credit, stacking, jams, fraud,
  cashbox removed, dispensing, payout errors, …).

## Requirements

- Node.js **>= 20** (required by `serialport` v13).
- A serial connection to the device (e.g. `/dev/ttyACM0`, `/dev/ttyUSB0`).
- Built on `serialport` v13.

## Installation

From npm:

```bash
npm install essp-smartpayout
```

```js
const SMARTPAYOUT = require('essp-smartpayout');
```

Or from source (uses Babel, since the source is written as ES modules):

```bash
git clone https://github.com/UrgenProchnoff/essp-smartpayout.git
cd essp-smartpayout
npm install
npm run build   # compiles to dist/
```

## Usage

```js
import SMARTPAYOUT from './module_smartpayout';

const payout = new SMARTPAYOUT();

payout.initialize({
  device: '/dev/ttyACM0', // serial port of the device
  type: 'SMARTPayout',
});

async function main() {
  // Establish the encrypted link and switch to protocol v6.
  await payout.Init();

  // Read device configuration (currency, channels, denominations).
  const setup = await payout.getSetup();
  console.log('setup', setup);

  // Read serial number and stored note levels.
  console.log('serial', await payout.getSerialNumber());
  console.log('levels', await payout.getAllLevels());

  // Accept notes (array selects acceptable currency codes).
  await payout.takeNote(setup.currency_code);

  // Run the poll loop while a transaction is active.
  await payout.pool();
}

payout.on('take_note', ({ note_nominal, note_number }) => {
  console.log('Accepted note', note_nominal);
});

payout.on('dispense_note', ({ note_nominal }) => {
  console.log('Dispensed note', note_nominal);
});

payout.on('error', err => {
  console.error('Device error', err);
});

main();
```

Because the source uses ES modules, run it through Babel, e.g.:

```bash
npx babel-node example.js
```

## Examples

Runnable examples live in [examples/](examples/). They require a real device
on a serial port (set via the `ESSP_DEVICE` environment variable):

```bash
# Read-only: serial number, setup, stored levels (safest to run first)
ESSP_DEVICE=/dev/ttyACM0 npx babel-node examples/device-info.js

# Accept an inserted note
ESSP_DEVICE=/dev/ttyACM0 npx babel-node examples/accept-note.js

# Dispense notes (this physically pays out cash)
ESSP_DEVICE=/dev/ttyACM0 NOMINAL=100 COUNT=1 npx babel-node examples/dispense-note.js
```

`npm run example` runs the read-only `device-info` example.

## High-level API (`SMARTPAYOUT`)

| Method | Description |
| --- | --- |
| `initialize(opts)` | Open the serial port and wire up device events. `opts = { device, type }`. |
| `Init()` | Sync, exchange keys and switch to protocol v6 (encrypted link). |
| `getSetup()` | Request device setup (currency, channels, denominations, multiplier). |
| `getSerialNumber()` | Return the device serial number. |
| `getAllLevels()` | Return stored note levels per denomination. |
| `setDenominationRoute(arr)` | Route each denomination to payout store or cashbox. |
| `takeNote(codes)` | Enable acceptance for the given currency codes. |
| `dispenseNote([nominal, count])` | Pay out `count` notes of `nominal`. |
| `pool()` | Poll the device while a transaction is in progress. |
| `display_on()` / `display_off()` | Toggle the bezel light. |
| `all_disable()` | Disable the validator. |

### Events

`take_note`, `dispense_note`, `pool_event`, and `error` are emitted by the
high-level class. The underlying `eSSP` instance ([lib/essp_smartpayout.js](lib/essp_smartpayout.js))
emits the full protocol event set, including: `ready`, `read_note`,
`credit_note`, `note_rejecting`, `note_stacking`, `note_stacked`,
`note_rejected`, `safe_note_jam`, `unsafe_note_jam`, `fraud_attempt`,
`stacker_full`, `cashbox_removed`, `cashbox_replaced`, `dispensing`,
`dispensed`, `jammed`, `incomplete_payout`, `emptying`, `emptied`,
`note_stored_in_payout`, `payout_out_of_service`, `jam_recovery`,
`error_during_payout`, and more.

## Project layout

```
.
├── module_smartpayout.js      # High-level SMARTPAYOUT class (accept / dispense)
└── lib/
    └── essp_smartpayout.js     # Low-level eSSP protocol driver
```

## Disclaimer

This is an independent, community project. It is not affiliated with or
endorsed by Innovative Technology Ltd. "SMART Payout", "NV200", "NV11" and
related names are trademarks of their respective owners. Use at your own risk.

## License

[MIT](LICENSE) © Evgenii Polomannyi
