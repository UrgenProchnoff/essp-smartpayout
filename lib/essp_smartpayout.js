//const fs = require ('fs');
const SerialPort = require ('serialport');
const forge = require ('node-forge');
const convertHex = require ('convert-hex');
const bigInt = require ('big-integer');
const EventEmitter = require ('event-emitter-es6');
const chalk = require ('chalk');
const moment = require ('moment');
const aesjs = require ('aes-js');
import hex2ascii from 'hex2ascii';
const InterByteTimeout = require ('@serialport/parser-inter-byte-timeout');

export default class eSSP extends EventEmitter {
  constructor () {
    super ();
    this.options = {};
    this.port = null;
    this.commands = null;
    this.count = 0;
    this.sequence = 0x80;
    this.currentCommand = '';
    this.held = false;

    this.keys = {
      generatorKey: null,
      modulusKey: null,
      hostRandom: null,
      hostIntKey: null,
      slaveIntKey: null,
      fixedKey: Buffer.from ('0123456701234567', 'hex'),
      key: null,
      fullKey: null,
    };
    this.flagComSend = 0; // 0 -- response resived
    this.flagEncOff = 0; // 1 -- encryption off
    this.last_packet = null;
    this.flagRetransmit = 0; // 1 -- retransmit need
    this.currentCommand1 = null;
    this.currentArgs = null;
    this.response_count = 0;
    this.flag_keynotset = 0;
  }

  initialize (opts) {
    let options = (this.options = {
      device: opts.device || null,
      baudRate: opts.baudrate || 9600,
      dataBits: opts.databits || 8,
      stopBits: opts.stopbits || 2,
      //parity: 'none',
      parity: opts.parity &&
        ['even', 'mark', 'odd', 'space'].indexOf (
          opts.parity.toString ().toLowerCase ()
        ) > -1
        ? opts.parity
        : 'none',
      //currencies: opts.currencies || [1, 1, 1, 1, 1, 1, 1, 1],
      type: opts.type || 'SmartPayout',
      sspID: opts.sspID || 0,
      seqence: opts.sequence || 0x80,
    });
    //console.log('essp options', options);
    const port = new SerialPort (
      options.device,
      {
        baudrate: options.baudrate,
        databits: options.databits,
        stopbits: options.stopbits,
        parity: options.parity,
        //parser: SerialPort.parsers.raw,
        parser: SerialPort.parsers.InterByteTimeout,
      },
      false
    );

    const parser = port.pipe (new InterByteTimeout ({interval: 15}));
    port.open (() => {
      parser.on ('data', buffer => {
        //console.log ('port.on', buffer.toString ('hex'));
        var ix = 0;
        let len = buffer[2] + 5;
        let buf = buffer.slice (ix, ix + len);
        //console.log ('buf   =', buf.toString ('hex'));
        //console.log ('len=', len);
        let bufferstr = buffer.toString ('hex');
        let len2 = bufferstr.length / 2;
        let bufstr = '';
        //console.log ('len2=', len2);
        if (len2 - len != 0) {
          let n_7f7f = len2 - len;
          for (let i = 0; i < n_7f7f; i++) {
            let pos7f7f = bufferstr.indexOf ('7f7f');
            bufstr =
              bufferstr.slice (0, pos7f7f + 2) + bufferstr.slice (pos7f7f + 4);
            console.log (chalk.red ('Wrong 7f7f'));
            bufferstr = bufstr.slice ();
          }
          //console.log ('bufstr=', bufstr);
          buf = Buffer.from (bufstr, 'hex');
        }

        this.parseBuffer (buf);
        //  ix += len;
        //} while (ix < buffer.length);
      });
    });
    port.on ('error', err => {
      console.log (chalk.red (err));
    });

    this.port = port;
  }

  //essp commands
  async initiateKeys () {
    var getRandomInt = function (min, max) {
      return Math.floor (Math.random () * (max - min)) + min;
    };

    var keyPair = forge.pki.rsa.generateKeyPair (64);
    this.keys.generatorKey = bigInt (keyPair.privateKey.p.toString ());
    console.log ('generatorKey=', this.keys.generatorKey.toString (16));
    this.keys.modulusKey = bigInt (keyPair.privateKey.q.toString ());
    console.log ('modulusKey=', this.keys.modulusKey.toString (16));
    this.keys.hostRandom = bigInt (getRandomInt (3, 47));
    this.keys.hostIntKey = this.keys.generatorKey.modPow (
      this.keys.hostRandom,
      this.keys.modulusKey
    );
    console.log ('hostIntKey=', this.keys.hostIntKey.toString (16));
    await this.sendGenerator ();
    await this.func_timeout ();
    await this.sendModulus ();
    await this.func_timeout ();
    await this.sendRequestKeyExchange ();
    await this.func_timeout ();
  }

  async keys_OK () {
    if (this.flag_keynotset == 1) {
      this.flag_keynotset = 0;
      this.keys.key = null;
      this.count = 0;
      await this.func_timeout2 ();
      await this.sync ();
      await this.func_timeout2 ();
      await this.initiateKeys ();
      await this.func_timeout2 ();
      await this.setProtocolv6 ();
    }
  }

  async sync () {
    //console.log("this.options",this.options);
    this.flagComSend = 1;
    var packet = this.toPackets (0x11, [], 'SYNC');
    var buff = new Buffer.from (packet);
    this.port.write (buff);
    await this.port.drain ();
    await this.wait_response ();
  }

  async sendGenerator () {
    this.flagComSend = 1;
    var generatorArray = this.parseHexString (
      this.keys.generatorKey.toString (16),
      this.keys.generatorKey.toString (16).length
    );
    var packet = this.toPackets (0x4a, generatorArray, 'SET_GENERATOR');
    var buff = new Buffer.from (packet);
    this.port.write (buff);
    this.port.drain ();
    await this.wait_response ();
  }

  async sendModulus () {
    this.flagComSend = 1;
    var modulusArray = this.parseHexString (
      this.keys.modulusKey.toString (16),
      this.keys.modulusKey.toString (16).length
    );
    var packet = this.toPackets (0x4b, modulusArray, 'SET_MODULUS');
    var buff = new Buffer.from (packet);
    this.port.write (buff);
    this.port.drain ();
    await this.wait_response ();
  }

  async sendRequestKeyExchange () {
    this.flagComSend = 1;
    var hostIntKeyString = this.keys.hostIntKey.toString (16);
    var hostIntKeyStringlength = hostIntKeyString.length;
    console.log ('hostIntKeyStringlength=', hostIntKeyStringlength);
    console.log ('hostIntKeyString1=', hostIntKeyString);
    if (hostIntKeyStringlength == 7) {
      // let ii = 8-hostIntKeyStringlength;
      // for (let i = 0; i < ii; i++) {
      hostIntKeyString = '0' + hostIntKeyString;
      console.log ('hostIntKeyString=', hostIntKeyString);
      //}
    }
    var hostIntArray = this.parseHexString (hostIntKeyString, 8);
    var packet = this.toPackets (0x4c, hostIntArray, 'REQUEST_KEY_EXCHANGE');
    var buff = new Buffer.from (packet);
    this.port.write (buff);
    this.port.drain ();
    await this.wait_response ();
  }

  
  /*  
    poll() {
      this.flagComSend = 1  
      let polling = async (resolve, reject) => {
        var packet = this.toPackets(0x07, [], 'POLL')
        var buff = new Buffer(packet)
        setTimeout(() => {
          this.port.write(buff, () => {
            this.port.drain()
            //if (!this.held) polling()
            //console.log(buff)
            
          })
        }, 200)
      }
      return new Promise(polling);
    }
  */

  async poll () {
    this.flagComSend = 1;
    var packet = this.toPackets (0x07, [], 'POLL');
    var buff = new Buffer.from (packet);
    this.port.write (buff);
    this.port.drain ();
    await this.wait_response ();
  }

  async setup_request () {
    this.flagComSend = 1;
    var packet = this.toPackets (0x05, [], 'SETUP_REQUEST');
    var buff = new Buffer.from (packet);
    this.port.write (buff);
    this.port.drain ();
    await this.wait_response ();
    //this.emit ('ready');
  }

  async reject_banknote () {
    this.flagComSend = 1;
    var packet = this.toPackets (0x08, [], 'REJECT_BANKNOTE');
    var buff = new Buffer.from (packet);
    this.port.write (buff);
    this.port.drain ();
    await this.wait_response ();
  }

  async hold () {
    this.flagComSend = 1;
    var packet = this.toPackets (0x18, [], 'HOLD');
    var buff = new Buffer.from (packet);
    this.port.write (buff);
    this.port.drain ();
    await this.wait_response ();
  }

  async all_enable () {
    this.flagComSend = 1;
    var packet = this.toPackets (0x0a, [], 'ENABLE');
    var buff = new Buffer.from (packet);
    
    this.port.write (buff);
    this.port.drain ();
    await this.wait_response ();
  }

  async all_disable () {
    this.flagComSend = 1;
    var packet = this.toPackets (0x09, [], 'DISABLE');
    var buff = new Buffer.from (packet);
    
    this.port.write (buff);
    this.port.drain ();
    await this.wait_response ();
  }

  async display_on () {
    this.flagComSend = 1;
    var packet = this.toPackets (0x03, [], 'DISPLAY_ON');
    var buff = new Buffer.from (packet);
    this.port.write (buff);
    this.port.drain ();
    await this.wait_response ();
  }

  async display_off () {
    this.flagComSend = 1;
    var packet = this.toPackets (0x04, [], 'DISPLAY_OFF');
    var buff = new Buffer.from (packet);
    this.port.write (buff);
    this.port.drain ();
    await this.wait_response ();
  }


  async setProtocolv6 () {
    this.flagComSend = 1;
    var packet = this.toPackets (0x06, [0x07], 'SPV6');
    var buff = new Buffer.from (packet);
    this.port.write (buff);
    this.port.drain ();
    await this.wait_response ();
  }

  async setInhibit (inhibit_array) {
    this.flagComSend = 1;
    var packet = this.toPackets (0x02, inhibit_array, 'SET_INHIBIT');
    var buff = new Buffer.from (packet);
    this.port.write (buff);
    this.port.drain ();
    await this.wait_response ();
  }

  async getAllLevels () {
    this.flagComSend = 1;
    var packet = this.toPackets (0x22, [], 'GET_ALL_LEVELS');
    var buff = new Buffer.from (packet);
    this.port.write (buff);
    this.port.drain ();
    await this.wait_response ();
  }

  async getSerialNumber () {
    this.flagComSend = 1;
    var packet = this.toPackets (0x0C, [], 'GET_SERIALNUMBER');
    var buff = new Buffer.from (packet);
    this.port.write (buff);
    this.port.drain ();
    await this.wait_response ();
  }

  async enablePayoutDevice () {
    this.flagComSend = 1;
    var packet = this.toPackets (0x5c, [], 'ENABLE_PAYOUT_DEVICE');
    var buff = new Buffer.from (packet);
    this.port.write (buff);
    this.port.drain ();
    await this.wait_response ();
  }

  async setDenominationRoute (denominationroute_array) {
    this.flagComSend = 1;
    var packet = this.toPackets (
      0x3b,
      denominationroute_array,
      //  [0x00, 0x10, 0x27, 0x00, 0x00, 0x52, 0x55, 0x42],
      'SET_DENOMINATION_ROUTE'
    );
    var buff = new Buffer.from (packet);
    this.port.write (buff);
    this.port.drain ();
    await this.wait_response ();
  }

  async payout () {
    this.flagComSend = 1;
    var packet = this.toPackets (
      0x33,
      [0x10, 0x27, 0x00, 0x00, 0x52, 0x55, 0x42, 0x58],
      'PAYOUT'
    );
    var buff = new Buffer.from (packet);
    this.port.write (buff);
    this.port.drain ();
    await this.wait_response ();
  }

  async payout_notes (notes_array) {
    this.flagComSend = 1;
    var packet = this.toPackets (0x46, notes_array, 'PAYOUT_NOTES');
    var buff = new Buffer.from (packet);
    this.port.write (buff);
    this.port.drain ();
    await this.wait_response ();
  }

  //end essp commands

  EncSet (flag) {
    this.flagEncOff = flag;
  }

  async wait_response () {
    let timeout_count = 0;
    let i = 0;
    do {
      if (this.flagComSend == 0) return true;
      let date = moment (new Date ()).format ('HH:mm:ss.SSS');
      //  console.log ( chalk.cyan (date),'tc=', timeout_count,'flag=',  this.flagComSend );

      if (timeout_count == 40) {
        //this.count--;
        timeout_count = 0;
        await this.retransmit_lastBuff ();
        console.log ('this.retransmit_lastBuff()');
      }

      //if (timeout_count == 40 || this.flagRetransmit == 1) {
      //timeout_count = 0;
      //this.count--;
      //await this.retransmit_lastCommand ();
      //await this.retransmit_lastBuff ();
      //this.flagRetransmit = 0;
      //console.log ('this.retransmit_lastBuff()');
      // }
      timeout_count++;
      i++;
      await this.func_timeout ();
    } while (i < 60);
    //console.log ('wait_response timeout');
    return false;
  }

  async func_timeout () {
    return new Promise ((resolve, reject) => {
      setTimeout (() => {
        resolve (true);
      }, 35);
    });
  }

  async func_timeout2 () {
    return new Promise ((resolve, reject) => {
      setTimeout (() => {
        resolve (true);
      }, 100);
    });
  }

  async retransmit_lastBuff () {
    let buf = new Buffer.from (this.last_packet);
    let bufferstr = buf.toString ('hex');
    console.log ('re bufferstr=', bufferstr);
    let pos7f2 = 2;
    let bufstr = '';
    while (
      //bufferstr.includes ('7f', pos7f2) &&
      pos7f2 < bufferstr.length &&
      bufferstr.indexOf ('7f', pos7f2) % 2 == 0
    ) {
      pos7f2 = bufferstr.indexOf ('7f', pos7f2);
      bufstr = bufferstr.slice (0, pos7f2 + 2) + bufferstr.slice (pos7f2);
      bufferstr = bufstr.slice ();
      console.log (chalk.red ('Wrong 7f2'));
      pos7f2 = pos7f2 + 4;
    }

    console.log ('re bufstr   =', bufstr);
    let buff = Buffer.from (bufstr, 'hex');
    //let buff = new Buffer.from (this.last_packet);
    console.log ('retransmit_lastBuff');
    let date = moment (new Date ()).format ('HH:mm:ss.SSS');
    console.log (
      chalk.cyan (date),
      this.options.type +' => ',
      chalk.blue (
        Array.prototype.slice.call (buff, 0).map (function (item) {
          return item.toString (16).toUpperCase ();
        })
      )
    );
    this.port.write (buff);
    this.port.drain ();
  }

  async retransmit_lastCommand () {
    //this.count--;
    var packet = this.toPackets (
      this.currentCommand1,
      this.currentArgs,
      this.currentCommand
    );
    let buff = new Buffer.from (packet);
    console.log ('retransmit_lastCommand');
    let date = moment (new Date ()).format ('HH:mm:ss.SSS');
    console.log (
      chalk.cyan (date),
      this.options.type +' => ',
      chalk.blue (
        Array.prototype.slice.call (buff, 0).map (function (item) {
          return item.toString (16).toUpperCase ();
        })
      )
    );
    this.port.write (buff);
    this.port.drain ();
  }

  parseHexString (str, count) {
    var a = [];
    str = str.padStart (count * 2, '0');
    for (var i = str.length; i > 0; i -= 2) {
      a.push (parseInt (str.substr (i - 2, 2), 16));
    }
    return a;
  }

  parseKeyString (str, count) {
    var a = [];
    str = str.padStart (count * 2, '0');
    for (var i = 0; i < str.length; i += 2) {
      a.push (parseInt (str.substr (i, 2), 16));
    }
    //for (var i = a.length; i < count; i++) {a.push (0);  }
    return a;
  }

  createHostEncryptionKeys (data) {
    if (this.keys.key == null) {
      console.log ('data=', data);
      data.shift ();
      var hexString = convertHex.bytesToHex (data.reverse ());
      var slaveIntKey = bigInt (hexString, 16);
      /*      
            var slaveIntKeyString = ''
            if (!slaveIntKey.isSmall) {
              var values = slaveIntKey.value.reverse();
              for (var i = 0; i < values.length; i++) {
                slaveIntKeyString += '' + values[i]
              }
            } else {
              slaveIntKeyString = slaveIntKey.value
            }
            this.keys.slaveIntKey = slaveIntKeyString
      */
      this.keys.slaveIntKey = slaveIntKey;
      console.log ('keys.slaveIntKey=', this.keys.slaveIntKey.toString (16));
      this.keys.key = this.keys.slaveIntKey.modPow (
        this.keys.hostRandom,
        this.keys.modulusKey
      );
      let key_temp = this.parseHexString (this.keys.key.toString (16), 4);
      this.keys.fullKey = this.parse (
        Array.prototype.slice.call (this.keys.fixedKey, 0),
        8
      )
        .reverse ()
        .concat (key_temp)
        .concat ([0, 0, 0, 0]);
      console.log (this.keys);
      console.log ();
    }
  }

  CRC16 (command) {
    var length = command.length, seed = 0xffff, poly = 0x8005, crc = seed;

    for (var i = 0; i < length; i++) {
      crc ^= command[i] << 8;
      for (var j = 0; j < 8; j++) {
        if (crc & 0x8000) {
          crc = ((crc << 1) & 0xffff) ^ poly;
        } else {
          crc <<= 1;
        }
      }
    }
    return [crc & 0xff, (crc >> 8) & 0xff];
  }

  getSequence () {
    if (this.sequence == 0x80) {
      this.sequence = 0x00;
    } else {
      this.sequence = 0x80;
    }
    return this.sequence;
  }

  generatePacking (commandLine) {
    var a = [];
    let commandLine_length = commandLine.length;
    if (commandLine_length <= 14) {
      for (let i = commandLine_length; i < 14; i++) {
        a.push (0);
      }
    } else {
      for (let i = (commandLine_length - 14) % 16; i < 16; i++) {
        a.push (0);
      }
    }
    return a;
  }

  parse (a, count) {
    for (let i = a.length; i < count; i++) {
      a.push (0);
    }
    return a;
  }

  toPackets (command, args = [], commandName) {
    this.currentCommand = commandName;
    this.currentCommand1 = command;
    this.currentArgs = args;
    var commandLine;
    var STX = 0x7f;
    var LENGTH = args.length + 1;
    var SEQ_SLAVE_ID = this.getSequence ();
    var DATA = [command].concat (args);

    commandLine = [SEQ_SLAVE_ID, LENGTH].concat (DATA);
    var crc = this.CRC16 (commandLine);
    commandLine = [STX].concat (commandLine, crc);

    let date = moment (new Date ()).format ('HH:mm:ss.SSS');
    /* console.log (
      chalk.cyan (date),
      this.options.type +' => ',
      chalk.yellow (
        Array.prototype.slice.call (commandLine, 0).map (function (item) {
          return item.toString (16).toUpperCase ();
        })
      ),
      '|',
      commandName,
      '|',
      'unecrypted'
    );
*/

    if (this.keys.key != null && this.flagEncOff == 0) {
      var STEX = 0x7e;
      var eLENGTH = DATA.length;

      var eCOUNT = this.parseHexString (this.count.toString (16), 4);
      this.count++;

      var eDATA = DATA;
      var eCommandLine = [eLENGTH].concat (eCOUNT, eDATA);
      var ePACKING = this.generatePacking (eCommandLine);
      eCommandLine = eCommandLine.concat (ePACKING);
      var eCRC = this.CRC16 (eCommandLine);
      eCommandLine = eCommandLine.concat (eCRC);

      console.log (
        chalk.cyan (date),
        this.options.type +' => ',
        chalk.yellow (
          Array.prototype.slice.call (eCommandLine, 0).map (function (item) {
            return item.toString (16).toUpperCase ();
          })
        ),
        '|',
        commandName,
        '|',
        'raw'
      );

      var aesCtr = new aesjs.ModeOfOperation.ecb (this.keys.fullKey);
      var uint8Array = aesCtr.encrypt (eCommandLine);
      //console.log("uint8Array=", uint8Array.toString())
      var eDATA = [].slice.call (uint8Array);

      //console.log ('eDATA=', convertHex.bytesToHex (eDATA));
      eCommandLine = [STEX].concat (eDATA);
      DATA = eCommandLine;
      LENGTH = DATA.length;
    }

    commandLine = [SEQ_SLAVE_ID, LENGTH].concat (DATA);
    crc = this.CRC16 (commandLine);
    commandLine = [STX].concat (commandLine).concat (crc);

    if (this.keys.key != null && this.flagEncOff == 0) {
      /* 
     let date = moment (new Date ()).format ('HH:mm:ss.SSS');
      console.log (
        chalk.cyan (date),
        this.options.type +' => ',
        chalk.yellow (
          Array.prototype.slice.call (commandLine, 0).map (function (item) {
            return item.toString (16).toUpperCase ();
          })
        ),
        '|',
        commandName,
        '|',
        'encrypted'
      );
   */
    }

    this.last_packet = commandLine;
    return commandLine;
  }

  parseBuffer (buffer) {
    var buf, data = [];
    let crc, edata, ebuf, ecrc;
    //console.log('parse buffer=', buffer)
    if (buffer[0] === 0x7f) {
      buf = buffer.toJSON ().data;
      data = buf.slice (3, 3 + buffer[2]);
      crc = this.CRC16 (buf.slice (1, buf[2] + 3));
      if (buf[buf.length - 2] !== crc[0] && buf[buf.length - 1] !== crc[1]) {
        console.log (chalk.red ('Wrong CRC from validator'));
        this.flagRetransmit = 1;
        return;
      }
      this.flagComSend = 0;
      //console.log ('parseBuffer this.flagComSend=', this.flagComSend);
      let date = moment (new Date ()).format ('HH:mm:ss.SSS');
      console.log (
        chalk.cyan (date),
        this.options.type+' <= ',
        chalk.green (
          Array.prototype.slice.call (buffer, 0).map (function (item) {
            return item.toString (16).toUpperCase ();
          })
        ),
        '|',
        //  chalk.magenta (data),
        this.currentCommand
      );

      if (buf[3] == 0x7e) {
        // encrypt response
        //console.log('buf=', buf)
        if ((buf[2] - 1) % 16 == 0) {
          //  16 byte

          let page = (buf[2] - 1) / 16;
          let aesCtr = new aesjs.ModeOfOperation.ecb (this.keys.fullKey);
          let ii = 1;
          let edata_page = [];
          while (ii <= page) {
            edata = buf.slice (4 + 16 * (ii - 1), 4 + 16 * ii);
            //console.log('edata=',edata);
            let uint8Array = aesCtr.decrypt (edata);
            edata_page = edata_page.concat ([].slice.call (uint8Array));
            //console.log('edata_page=',edata_page);
            //console.log('edata_page.length=',edata_page.length);
            ii++;
          }
          ecrc = this.CRC16 (edata_page.slice (0, edata_page.length - 2));
          //console.log('ecrc=',ecrc)
          if (
            edata_page[edata_page.length - 2] !== ecrc[0] &&
            edata_page[edata_page.length - 1] !== ecrc[1]
          ) {
            console.log (chalk.red ('Wrong eCRC from validator'));
            return;
          }

          this.response_count = edata_page[1];
          if (this.response_count < this.count) {
            this, (this.count = this.response_count);
            this.flagRetransmit = 1;
            console.log ('edata_page=', edata_page);
            console.log (chalk.red ('Wrong count from response validator'));
            return;
          }

          date = moment (new Date ()).format ('HH:mm:ss.SSS');
          console.log (
            chalk.cyan (date),
            this.options.type + ' <= ',
            chalk.green (
              Array.prototype.slice.call (edata_page, 0).map (function (item) {
                return item.toString (16).toUpperCase ();
              })
            ),
            '|',
            //  chalk.magenta (edata_page),
            this.currentCommand,
            '|',
            'decrypted'
          );
          console.log ('');
          data = edata_page.slice (5, 5 + edata_page[0]);
        } else {
          console.log (chalk.red ('Wrong 16 bytes pages encrypt error'));
          return;
        }
      }

      if (this.currentCommand == 'REQUEST_KEY_EXCHANGE') {
        if (data[0] == 240) {
          this.createHostEncryptionKeys (data);
          //console.log(this.keys)
        }
      } else if (this.currentCommand == 'SYNC') {
        if (data[0] == 240) {
          this.sequence = 0x80;
        }
      } else if (this.currentCommand == 'HOLD') {
        if (data[0] == 240) {
          this.held = true;
        }
      } else if (this.currentCommand == 'GET_SERIALNUMBER') {
        if (data[0] == 240) {
          //console.log('get serial data=', data);
          let serialnumber =  (
            data[1].toString (10) +
            data[2].toString (10) +
            data[3].toString (10) +
            data[4].toString (10) 
          );
          let event = [
            'get_serialnumber',
            {
              serialnumber,
            },
          ];
          this.emit.apply (this, event);

        }
      } else if (this.currentCommand == 'GET_ALL_LEVELS') {
        if (data[0] == 240) {
          let nominal = data[1];
          let i = 0;
          let all_levels = [];
          let all_nominals = [];
          let level = [];
          while (i < nominal) {
            let nom = data.slice (2 + 9 * i, 11 + 9 * i);
            //console.log("nom=",nom);

            //let hexString = convertHex.bytesToHex (nom.slice(2,5).reverse ());
            //console.log("hexString=",hexString);
            //var slaveIntKey = bigInt (hexString, 16);

            level[0] = parseInt (
              convertHex.bytesToHex (nom.slice (0, 1).reverse ()),
              16
            );
            level[1] =
              parseInt (
                convertHex.bytesToHex (nom.slice (2, 5).reverse ()),
                16
              ) / 100;
            level[2] = hex2ascii (
              nom[6].toString (16) + nom[7].toString (16) + nom[8].toString (16)
            );
            //console.log("level=",level);
            //console.log("i=",i);
            all_levels[i] = level[0];
            all_nominals[i] = level[1];
            i++;
          }
          //console.log("all_levels=",all_levels);
          let event = [
            'get_all_levels',
            {
              all_levels,
              all_nominals,
            },
          ];
          this.emit.apply (this, event);
        }
      } else if (this.currentCommand == 'SETUP_REQUEST') {
        if (data[0] == 240) {
          let firmwareVersion = hex2ascii (
            data[2].toString (16) +
              data[3].toString (16) +
              data[4].toString (16) +
              data[5].toString (16)
          );
          let currency = hex2ascii (
            data[6].toString (16) +
              data[7].toString (16) +
              data[8].toString (16)
          );
          let currency_code = [data[6], data[7], data[8]];
          let channelsCount = data[12];

          let valueMultiplier = parseInt (
            data[13 + channelsCount * 2].toString (16) +
              data[13 + 1 + channelsCount * 2].toString (16) +
              data[13 + 2 + channelsCount * 2].toString (16),
            16
          );

          const protocolVersion = data[16 + channelsCount * 2];
          let channelDenomination = [];
          for (let i = 0; i < channelsCount * 1; i++) {
            let denomination = parseInt (
              data[17 + 3 + channelsCount * 5 + i * 4].toString (16) +
                data[17 + 2 + channelsCount * 5 + i * 4].toString (16) +
                data[17 + 1 + channelsCount * 5 + i * 4].toString (16) +
                data[17 + 0 + channelsCount * 5 + i * 4].toString (16),
              16
            );
            channelDenomination.push (denomination);
          }
          let event = [
            'setup_request',
            {
              currency,
              currency_code,
              firmwareVersion,
              channelsCount,
              channelDenomination,
              valueMultiplier,
              protocolVersion,
            },
          ];
          this.emit.apply (this, event);
        }
      } else {
        this.emitEvent (data, buffer);
      }
    } else {
      console.log ('unregistered_data=', buffer);
      this.emit ('unregistered_data', buffer);
    }
  }

  emitEvent (data, buffer) {
    let error = new Error ('New error');
    error.code = data[0];
    switch (data[0]) {
      case 0xf2:
        error.message = 'Command not known';
        break;
      case 0xf3:
        error.message = 'Wrong no parameters';
        break;
      case 0xf4:
        error.message = 'Parameter out of range';
        break;
      case 0xf5:
        error.message = 'Command cannot be processed';
        break;
      case 0xf6:
        error.message = 'Software error';
        break;
      case 0xf8:
        error.message = 'Fail';
        break;
      case 0xfa:
        error.message = 'Key not set';
        this.flag_keynotset = 1;
        this.flagComSend = 0;
        break;
      case 0xf0:
        break;
      default:
        error.message = 'Unknown error';
    }
    if (error.code !== 0xf0) {
      this.emit ('error', error, buffer);
    } else if (data.length > 1) {
      var event;
      switch (data[1]) {
        case 0xf1: //all
          event = ['slave_reset'];
          break;
        case 0xef: //bv20|bv50|bv100|nv9usb|nv10usb|nv200|SMART Payout|nv11
          event = ['read_note', data[2]];
          break;
        case 0xee: //bv20|bv50|bv100|nv9usb|nv10usb|nv200|SMART Payout|nv11
          event = ['credit_note', data[2]];
          break;
        case 0xed: //bv20|bv50|bv100|nv9usb|nv10usb|nv200|SMART Payout|nv11
          event = ['note_rejecting'];
          break;
        case 0xec: //bv20|bv50|bv100|nv9usb|nv10usb|nv200|SMART Payout|nv11
          //recieve reject code
          // self.commands.exec('last_reject_code');
          break;
        case 0xcc: //bv20|bv50|bv100|nv9usb|nv10usb|nv200|SMART Payout|nv11
          event = ['note_stacking'];
          break;
        case 0xeb: //bv20|bv50|bv100|nv9usb|nv10usb|nv200|SMART Payout|nv11
          event = ['note_stacked'];
          break;
        case 0xea: //bv20|bv50|bv100|nv9usb|nv10usb|nv200|SMART Payout|nv11
          event = ['safe_note_jam'];
          break;
        case 0xe9: //bv20|bv50|bv100|nv9usb|nv10usb|nv200|SMART Payout|nv11
          event = ['unsafe_note_jam'];
          break;
        case 0xe8: //all
          event = ['disabled'];
          break;
        case 0xe6: //bv20|bv50|bv100|nv9usb|nv10usb|nv200|nv201|SMART Payout|nv11|SMART Hopper
          event = ['fraud_attempt', data[2]];
          break;
        case 0xe7: //bv20|bv50|bv100|nv9usb|nv10usb|nv200|SMART Payout|nv11
          event = ['stacker_full'];
          break;
        case 0xe1: //bv20|bv50|bv100|nv9usb|nv10usb|nv200|nv201|SMART Payout|nv11
          event = ['note_cleared_from_front', data[2]];
          break;
        case 0xe2: //bv20|bv50|bv100|nv9usb|nv10usb|nv200|nv201|SMART Payout|nv11
          event = ['note_cleared_to_cashbox', data[2]];
          break;
        case 0xe3: //bv50|bv100|nv200|SMART Payout|nv11
          event = ['cashbox_removed'];
          break;
        case 0xe4: //bv50|bv100|nv200|SMART Payout|nv11
          event = ['cashbox_replaced'];
          break;
        case 0xe5: //nv200|nv201
          event = ['barcode_ticket_validated'];
          break;
        case 0xd1: //nv200|nv201
          event = ['barcode_ticket_acknowledge'];
          break;
        case 0xe0: //nv200
          event = ['note_path_open'];
          break;
        case 0xb5: //bv20|bv50|bv100|nv9usb|nv10usb|nv200|SMART Payout|nv11
          event = ['channel_disable'];
          break;
        case 0xb6: //bv20|bv50|bv100|nv9usb|nv10usb|nv200|nv201|SMART Payout|nv11|SMART Hopper
          event = ['initialing'];
          break;
        case 0xda: //SMART payout|SMART Hopper|nv11
          event = ['dispensing', data[2]];
          break;
        case 0xd2: //SMART payout|SMART Hopper|nv11
          event = ['dispensed', data[2]];
          break;
        case 0xd2: //SMART payout|SMART Hopper|nv11
          event = ['jammed', data[2]];
          break;
        case 0xd6: //SMART payout|SMART Hopper|nv11
          event = ['halted', data[2]];
          break;
        case 0xd7: //SMART payout|SMART Hopper
          event = ['floating', data[2]];
          break;
        case 0xd8: //SMART payout|SMART Hopper
          event = ['floated', data[2]];
          break;
        case 0xd9: //SMART payout|SMART Hopper|nv11
          event = ['timeout', data[2]];
          break;
        case 0xdc: //SMART payout|SMART Hopper|nv11
          event = ['incomplete_payout', data[2]];
          break;
        case 0xdd: //SMART payout|SMART Hopper|nv11
          event = ['incomplete_payout', data[2]];
          break;
        
          case 0xde: //SMART Hopper
          event = ['cashbox_paid', data[2]];
          break;
        case 0xdf: //SMART Hopper
          event = ['coin_credit', data[2]];
          break;
        case 0xc4: //SMART Hopper
          event = ['coin_mech_jammed'];
          break;
        case 0xc5: //SMART Hopper
          event = ['coin_mech_return_pressed'];
          break;
        case 0xb7: //SMART Hopper
          event = ['coin_mech_error'];
          break;
        case 0xc2: //SMART payout|SMART Hopper|nv11
          event = ['emptying'];
          break;
        case 0xc3: //SMART payout|SMART Hopper|nv11
          event = ['emptied'];
          break;
        case 0xb3: //SMART payout|SMART Hopper|nv11
          event = ['smart_emptying', data[2]];
          break;
        case 0xb4: //SMART payout|SMART Hopper|nv11
          event = ['smart_emptied', data[2]];
          break;
        case 0xdb: //SMART payout|nv11
          event = ['note_stored_in_payout', data[2]];
          break;
        case 0xc6: //SMART payout|nv11
          event = ['payout_out_of_service'];
          break;
        case 0xb0: //SMART payout
          event = ['jam_recovery'];
          break;
        case 0xb1: //SMART payout
          event = ['error_during_payout'];
          break;
        case 0xc9: //SMART payout|nv11
          event = ['note_transfered to stacker', data[2]];
          break;
        case 0xce: //SMART payout|nv11
          event = ['note_held_in_bezel', data[2]];
          break;
        case 0xcb: //SMART payout|nv11
          event = ['note_paid_into_store_at_powerup', data[2]];
          break;
        case 0xcb: //SMART payout|nv11
          event = ['note_paid_into_stacker_at_powerup', data[2]];
          break;
        case 0xcd: //nv11
          event = ['note_dispensed_at_powerup', data[2]];
          break;
        case 0xc7: //nv11
          event = ['note_float_removed'];
          break;
        case 0xc8: //nv11
          event = ['note_float_attached'];
          break;
        case 0xc9: //nv11
          event = ['device_full'];
          break;
        //Reject reasons
        case 0x0:
        case 0x1:
        case 0x2:
        case 0x3:
        case 0x4:
        case 0x5:
        case 0x6:
        case 0x7:
        case 0x8:
        case 0x9:
        case 0xa:
        case 0xb:
        case 0xc:
        case 0xd:
        case 0xe:
        case 0xf:
        case 0x10:
        case 0x11:
        case 0x12:
        case 0x13:
        case 0x14:
        case 0x15:
        case 0x16:
        case 0x17:
        case 0x18:
        case 0x19:
        case 0x1a:
        case 0x1b:
        case 0x1c:
          event = ['note_rejected', data[1]];
          break;
      }
      event && this.emit.apply (this, event);
    }
  }
}
