import eSSP from './lib/essp_smartpayout';
const EventEmitter = require('event-emitter-es6');


export default class SMARTPAYOUT extends EventEmitter {
  constructor() {
    super();
    this.options = {};
    this.esspInstance=null;


    this.flag = {
      serialnumber: 0,
      all_levels: 0,
      setup: 0,
      takenote: 0,
      wait_ok: 0,
      dispensenote: 0,
      pool: 0,

     // payout_status: 0,
    };


      

    this.serialnumber = null;
    this.all_levels = null;
    this.all_nominals = null;
    this.setup = null;
    this.takenote = null;
    this.Date_time = new Date();
    //this.dispensenote_before = 0;
    this.dispensenote_num = [];
    //this.pool_count = 0;

    //this.payout_status = null;
    this.activity_time =0;
    




/*
    this.curr1 = 'RUB';
    this.curr1_code = [0x52, 0x55, 0x42];
    this.channelsCount = 8;
 */   




  }

  initialize(opts) {
   
    let options = (this.options = {
      device: opts.device, // || '/dev/ttyUSB0', //device address
      type: opts.type, // || 'ICTcc6100', //device type
    });
    console.log("opts Smartpayout=", options);
    

    const esspInstance = new eSSP();
    esspInstance.initialize ({
      device: opts.device, // || '/dev/ttyACM0', //device address
      type: opts.type, // || 'SMARTPayout', //device type
      //currencies: [1, 1, 1, 1, 1, 1, 1, 1], //currencies types acceptable. Here all but 100USD
    });
    
    this.esspInstance=esspInstance;

    esspInstance.on ('ready', async () => {
      //await esspInstance.poll()
      //await esspInstance.func_timeout2 ()
      console.log ('ready');
      this.emit ('ready');
    });
    esspInstance.on ('note_rejected', reason => {
      console.log ('Rejected!', reason);
    });




    esspInstance.on ('read_note', note => {
      console.log ('read_note', note);
    });
    
    esspInstance.on ('credit_note', note => {
      console.log("credit=", note);
      this.takenote = this.all_nominals[note-1];
      this.flag.takenote = 1;
      let event = ['take_note', {note_nominal: this.takenote, note_number: note-1 },];
      this.emit.apply (this, event);
      this.flag.pool = 0;
      this.all_disable();
    });

    esspInstance.on ('note_rejecting', () => {
      console.log ('note_rejecting');
    });
    esspInstance.on ('note_stacking', () => {
      console.log ('note_stacking');
    });
    esspInstance.on ('note_stacked', () => {
      console.log ('note_stacked');
    });
    esspInstance.on ('safe_note_jam', note => {
      console.log ('Jammed', note);
      let event = ['error', { code: 3, message: 'Jammed', },];
      this.emit.apply (this, event);
    });
    esspInstance.on ('unsafe_note_jam', note => {
      console.log ('Jammed inside', note);
      let event = ['error', { code: 3, message: 'Jammed inside', },];
      this.emit.apply (this, event);
    });
    esspInstance.on ('disabled', () => {
      console.log ('disabled');
    });
    esspInstance.on ('fraud_attempt', note => {
      console.log ('Fraud!', note);
      let event = ['error', { code: 3, message: 'Fraud!', },];
      this.emit.apply (this, event);
    });
    esspInstance.on ('stacker_full', () => {
      console.log ("stacker_full");
      let event = ['error', { code: 3, message: 'stacker_full', },];
      this.emit.apply (this, event);
      //esspInstance.all_disable ();
    });
    esspInstance.on ('note_cleared_from_front', note => {
      console.log ('note_cleared_from_front', note);
    });
    esspInstance.on ('note_cleared_to_cashbox', note => {
      console.log ('note_cleared_to_cashbox', note);
    });
    esspInstance.on ('cashbox_removed', () => {
      console.log ('cashbox_removed');
      let event = ['error', { code: 3, message: 'cashbox_removed', },];
      this.emit.apply (this, event);
    });
    esspInstance.on ('cashbox_replaced', () => {
      console.log ('cashbox_replaced');
      let event = ['error', { code: 3, message: 'cashbox_replaced', },];
      this.emit.apply (this, event);
    });
    esspInstance.on ('channel_disable', () => {
      console.log ('channel_disable');
    });
    esspInstance.on ('initialing', () => {
      console.log ('initialing');
    });
    esspInstance.on ('dispensing', note => {
      console.log ('dispensing', note);
    });

    esspInstance.on ('dispensed', note => {
      console.log ('dispensed', note);
      //this.dispensenote = this.all_nominals[note-1];
      this.flag.dispensenote = 0;
      let event = ['dispense_note', {note_nominal: this.dispensenote_num[0], note_number: this.dispensenote_num[1] },];
      this.emit.apply (this, event);
      this.flag.pool = 0;
      this.all_disable();


    });

    esspInstance.on ('jammed', note => {
      console.log ('jammed', note);
      let event = ['error', { code: 3, message: 'jammed', },];
      this.emit.apply (this, event);
    });
    esspInstance.on ('halted', note => {
      console.log ('halted', note);
    });
    esspInstance.on ('floating', note => {
      console.log ('floating', note);
    });
    esspInstance.on ('floated', note => {
      console.log ('floated', note);
    });
    esspInstance.on ('timeout', note => {
      console.log ('timeout', note);
    });
    esspInstance.on ('incomplete_payout', note => {
      console.log ('incomplete_payout', note);
      let event = ['error', { code: 3, message: 'incomplete_payout', },];
      this.emit.apply (this, event);
    });
    esspInstance.on ('incomplete_float', note => {
      console.log ('incomplete_float', note);
      let event = ['error', { code: 3, message: 'incomplete_float', },];
      this.emit.apply (this, event);
    });
    esspInstance.on ('emptying', () => {
      console.log ('emptying');
    });
    esspInstance.on ('emptied', () => {
      console.log ('emptied');
    });
    esspInstance.on ('smart_emptying', note => {
      console.log ('smart_emptying', note);
    });
    esspInstance.on ('smart_emptied', note => {
      console.log ('smart_emptied', note);
    });
    esspInstance.on ('note_stored_in_payout', note => {
      console.log ('note_stored_in_payout', note);
    });
    esspInstance.on ('payout_out_of_service', note => {
      console.log ('payout_out_of_service', note);
    });
    esspInstance.on ('jam_recovery', () => {
      console.log ('jam_recovery');
      let event = ['error', { code: 3, message: 'jam_recovery', },];
      this.emit.apply (this, event);
    });
    esspInstance.on ('error_during_payout', () => {
      console.log ('error_during_payout');
      let event = ['error', { code: 3, message: 'error_during_payout', },];
      this.emit.apply (this, event);
    });
    esspInstance.on ('note_transfered to stacker', note => {
      console.log ('note_transfered to stacker', note);
    });
    esspInstance.on ('note_held_in_bezel', note => {
      console.log ('note_held_in_bezel', note);
    });
    esspInstance.on ('note_paid_into_store_at_powerup', note => {
      console.log ('note_paid_into_store_at_powerup', note);
      let event = ['error', { code: 3, message: 'note_paid_into_store_at_powerup', },];
      this.emit.apply (this, event);
    });
    esspInstance.on ('note_paid_into_stacker_at_powerup', note => {
      console.log ('note_paid_into_stacker_at_powerup', note);
      let event = ['error', { code: 3, message: 'note_paid_into_stacker_at_powerup', },];
      this.emit.apply (this, event);
    });
    


    esspInstance.on ('error', err => {
      console.log (err.code, err.message);
      let event = ['error', { code: 3, message: JSON.stringify(err), },];
      this.emit.apply (this, event);
    });


    esspInstance.on ('setup_request', data => {
      console.log ('data', data);
      this.setup = data;

      //this.curr1 = data.currency;
      //this.curr1_code = data.currency_code;
      //this.channelsCount = data.channelsCount;
      this.all_nominals = data.channelDenomination;
      this.flag.setup = 1;
      
    });

    esspInstance.on ('get_all_levels', data => {
      console.log ('data', data);
      this.all_levels = data.all_levels;
      this.flag.all_levels = 1;
      
    });
    
    esspInstance.on ('get_serialnumber', data => {
      console.log ('data', data);
      this.serialnumber = data;
      this.flag.serialnumber = 1;
      
    });
   

  }

  async   Init () {
    await this.esspInstance.sync ();
    await this.esspInstance.func_timeout2 ();
    await this.esspInstance.initiateKeys ();
    await this.esspInstance.func_timeout2 ();
    await this.esspInstance.setProtocolv6 ();
    await this.esspInstance.keys_OK ();
  }
 

  async   getAllLevels () {
    this.flag.all_levels = 0;
    await this.esspInstance.func_timeout2 ();
    await this.esspInstance.getAllLevels ();
    //console.log ('all_levels=', this.all_levels);
    await this.promis_command(this.flag, "all_levels");
    return this.all_levels;
  }

  async   getSerialNumber () {
    this.flag.serialnumber = 0;
    await this.esspInstance.func_timeout2 ();
    await this.esspInstance.getSerialNumber ();
    await this.promis_command(this.flag, "serialnumber");  
    return this.serialnumber.serialnumber;

  }
  
  async   getSetup() {
    this.flag.setup = 0;
    await this.esspInstance.func_timeout2 ();
    await this.esspInstance.setup_request ();
    await this.promis_command(this.flag, "setup");  
    return this.setup;

  }

  async promis_command(flag, prop, timeout = 10000) {
    return new Promise((resolve, reject) => {
      let waited = 0;
      let interval = setInterval(() => {
        if (flag[prop] == 1) {
          clearInterval(interval);
          resolve(true);
        }
        else {
          waited += 100;
          if (waited >= timeout) {
            clearInterval(interval);
            reject(new Error('Timeout waiting for ' + prop + ' response'));
          }
        }
      }, 100);
    });
  }


  async   SetDenominationRoute (route_array) {
    let out_route_array = [];
    for (let i = 0; i < route_array.length; i++) {
      out_route_array = [0];
      if (route_array[i] == 1) {
        out_route_array = [1];
      }
      out_route_array = out_route_array
        .concat (
          this.esspInstance.parseHexString (
            (this.all_nominals[i] * this.setup.valueMultiplier).toString (16),
            4
          )
        )
        .concat (this.setup.currency_code);
      console.log("all_nominals[i]=", this.all_nominals[i]);
      console.log("out_route_array=", out_route_array);  
      await this.esspInstance.func_timeout2 ();
      await this.esspInstance.setDenominationRoute (out_route_array);
    }
  }
  

  async takeNote(nominals) {
    // nominals: optional array of note values to accept (e.g. [100, 500]);
    // omit (or pass an empty array) to accept every denomination
    let inhibit_mask = [0xff, 0xff];
    if (Array.isArray(nominals) && nominals.length > 0) {
      inhibit_mask = [0x00, 0x00];
      for (let i = 0; i < this.all_nominals.length && i < 16; i++) {
        if (nominals.indexOf(this.all_nominals[i]) > -1) {
          inhibit_mask[Math.floor(i / 8)] |= 1 << i % 8;
        }
      }
    }
    console.log('inhibit_mask=', inhibit_mask);
    this.flag.takenote = 0;
    this.takenote = null;
    await this.esspInstance.func_timeout2 ();
    await this.SetDenominationRoute ([0, 0, 0, 0, 0, 0, 0, 0]);
    await this.esspInstance.func_timeout2 ();
    await this.esspInstance.enablePayoutDevice ();
    await this.esspInstance.func_timeout2 ();
    await this.esspInstance.poll ();
    await this.esspInstance.func_timeout2 ();
    await this.esspInstance.setInhibit (inhibit_mask);
    await this.esspInstance.func_timeout2 ();
    await this.esspInstance.all_enable ();
    await this.esspInstance.func_timeout2 ();  
        
    this.flag.pool = 1;
    let event = ['pool_event'];
    this.emit.apply (this, event);
    
    return 1;
  }



  
  async dispenseNote(num_out) {
    console.log('num_out=', num_out);
    //let before = await this.getAllLevels();
    //console.log("dispenseCoin bef = ", before);
    //this.dispensenote_before = before;
    this.dispensenote_num = num_out;
    //this.flag.wait_ok = 0;
    this.flag.dispensenote = 1;

    //this.dispensecoin=null;
    
    let pay_value = num_out;
    let notes_array = [];
    let test_byte = 0x58;
    console.log ('pay_value=', pay_value);
    
        let notes_count_arr = this.esspInstance.parseHexString (
          pay_value[1].toString (16),
          2
        );
        console.log ('notes_count_arr=', notes_count_arr);
        
        let nominals_out_arr = this.esspInstance.parseHexString (
          (pay_value[0] * this.setup.valueMultiplier).toString (16),
          4
        );
        console.log ('nominals_out_arr=', nominals_out_arr);

        notes_array = notes_count_arr.concat (nominals_out_arr).concat (this.setup.currency_code);
        console.log ('notes_array=', notes_array);
    

    notes_array = [1].concat (notes_array).concat ([test_byte]);
    console.log ('notes_array=', notes_array);
  
    await this.esspInstance.enablePayoutDevice ();
    await this.esspInstance.poll ();
    await this.esspInstance.func_timeout2 ();
    await this.esspInstance.all_enable ();
    await this.esspInstance.poll ();
    await this.esspInstance.func_timeout2 ();
    await this.esspInstance.payout_notes (notes_array);
    await this.esspInstance.func_timeout2 ();
    
    this.flag.pool = 1;
    let event = ['pool_event'];
    this.emit.apply (this, event);
    return 1;
    
  }

/*
  async dispenseValue(value) {
    console.log('dis value=', value);
    //console.log('this.setup.CoinTypeCredit=', this.setup.CoinTypeCredit);
    let before = await this.getTubeValue();
    console.log("dispenseCoin bef = ", before);
    
    this.flag.wait_ok = 0;
    await this.mdbInstance.dispenseValue(value)
    await this.promis_command(this.flag, 'wait_ok');
    //return 1;
    this.flag.payout_status = 0;
    await this.mdbInstance.payoutStatus();
    await this.promis_command(this.flag, 'payout_status');
    
    let after = await this.getTubeValue();
    console.log("dispenseCoin aft = ", after);
    return this.payout_status;    

  }
*/

  async all_disable() {
    this.flag.pool = 0;
    await this.esspInstance.func_timeout2();
    await this.esspInstance.all_disable();
    await this.esspInstance.func_timeout2();
    return 1;
  }

  async display_on() {    
    await this.esspInstance.func_timeout2 ();
    await this.esspInstance.all_enable ();
    await this.esspInstance.func_timeout2();
    await this.esspInstance.display_on();
    //await this.esspInstance.func_timeout2();
    return 1;
  }

  async display_off() {
    await this.esspInstance.func_timeout2();
    await this.esspInstance.display_off();
    //await this.esspInstance.func_timeout2();
    return 1;
  }

  async pool() {

//      let count = 0;
      let i = 0;
      while (i < 400 && this.flag.pool == 1) {
        console.log("i=", i);
        await this.esspInstance.func_timeout2 ();
        await this.esspInstance.poll ();
        await this.esspInstance.func_timeout2 ();
        await this.esspInstance.func_timeout2 ();
        await this.esspInstance.func_timeout2 ();
        await this.esspInstance.func_timeout2 ();
  //      count++;
    i++;
    }

  }
   
  async func_timeout(time) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        resolve(true);
      }, time);
    });
  }








}




/*
setTimeout (async () => {
  await Init ();
  await SetupRequest ();
  await AllLevels();
  //await PayoutNotes([0,2,1,0,0,0,0,0]);
  //let temp = await Taking(200, [0,0,0,0,0,0,0,0]);
  //console.log("take credit=", temp);
}, 50);
*/

  /*
  async   PayoutNotes (pay_value) {
    let count = 0;
    let notes_array = [];
    let test_byte = 0x58;
    console.log ('pay_value=', pay_value);
    for (let i = 0; i < pay_value.length; i++) {
      if (pay_value[i] != 0) {
        count++;
        let notes_count_arr = esspInstance.parseHexString (
          pay_value[i].toString (16),
          2
        );
        console.log ('notes_count_arr=', notes_count_arr);
        let nominals_out_arr = esspInstance.parseHexString (
          (all_nominals[i] * 100).toString (16),
          4
        );
        console.log ('nominals_out_arr=', nominals_out_arr);
        notes_array = notes_array.concat (
          notes_count_arr.concat (nominals_out_arr).concat (curr1_code)
        );
        console.log ('notes_array=', notes_array);
      }
    }
    notes_array = [count].concat (notes_array).concat ([test_byte]);
    console.log ('notes_array_posl=', notes_array);
  
    await esspInstance.enablePayoutDevice ();
    await esspInstance.poll ();
    await esspInstance.func_timeout2 ();
    await esspInstance.enable ();
    await esspInstance.poll ();
    await esspInstance.func_timeout2 ();
    await esspInstance.payout_notes (notes_array);
  
    //await esspInstance.EncSet (1);
    let i = 0;
    while (i < 40) {
      await esspInstance.poll ();
      await esspInstance.func_timeout2 ();
      await esspInstance.func_timeout2 ();
      await esspInstance.func_timeout2 ();
      await esspInstance.func_timeout2 ();
      i++;
    }
  }


  async   Taking (target_credit, rejekted_notes_arr) {
    session_rejekted_arr=rejekted_notes_arr;
    session_target_credit=target_credit;
    await SetDenominationRoute ([0, 0, 0, 0, 0, 0, 0, 0]);
    await esspInstance.func_timeout2 ();
    await esspInstance.enablePayoutDevice ();
    await esspInstance.func_timeout2 ();
    await esspInstance.poll ();
    await esspInstance.func_timeout2 ();
    await esspInstance.setInhibit ([0xff, 0xff]);
    await esspInstance.func_timeout2 ();
    await esspInstance.enable ();
    await esspInstance.func_timeout2 ();
    session_credit=0;
    flag_notes=0;
    let i = 0;
    while (i < 60)  {
      await esspInstance.poll ();
      await esspInstance.func_timeout2 ();
      if (session_credit>=session_target_credit){
        return session_credit;
      }
      if (flag_notes==1){
        i=0;
        flag_notes=0;
      }
      await esspInstance.func_timeout2 ();
      await esspInstance.func_timeout2 ();
      await esspInstance.func_timeout2 ();
      await esspInstance.func_timeout2 ();
      i++;
    }
    return session_credit;  
  }
  
*/

