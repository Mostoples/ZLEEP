/*
  ZLEEP BLE Protocol
  ──────────────────
  Service UUID : 6e400001-b5a3-f393-e0a9-e50e24dcca9e  (Nordic UART Service)
  TX Char UUID : 6e400003-b5a3-f393-e0a9-e50e24dcca9e  (device → app, notifications)
  RX Char UUID : 6e400002-b5a3-f393-e0a9-e50e24dcca9e  (app → device, write)

  Packet format (12 bytes, little-endian int16 × 6):
    bytes  0- 1 : accel X  (unit: 0.01 g)
    bytes  2- 3 : accel Y
    bytes  4- 5 : accel Z
    bytes  6- 7 : gyro  X  (unit: 0.01 °/s)
    bytes  8- 9 : gyro  Y
    bytes 10-11 : gyro  Z
*/

const BLE_SERVICE  = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const BLE_TX_CHAR  = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';
const BLE_RX_CHAR  = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';

class ZleepBluetooth {
  constructor(onData, onStatusChange) {
    this.device     = null;
    this.server     = null;
    this.txChar     = null;
    this.rxChar     = null;
    this.onData     = onData;
    this.onStatus   = onStatusChange;
    this.connected  = false;
    this._boundDisconnect = this._onDisconnected.bind(this);
  }

  get isConnected() { return this.connected; }

  async connect() {
    if (!navigator.bluetooth) {
      throw new Error('Web Bluetooth API tidak tersedia di browser ini. Gunakan Chrome/Edge terbaru.');
    }

    this.device = await navigator.bluetooth.requestDevice({
      filters: [
        { name: 'ZLEEP' },
        { namePrefix: 'ZLEEP' },
        { namePrefix: 'Zleep' }
      ],
      optionalServices: [BLE_SERVICE]
    });

    this.device.addEventListener('gattserverdisconnected', this._boundDisconnect);

    this.server = await this.device.gatt.connect();
    const service = await this.server.getPrimaryService(BLE_SERVICE);
    this.txChar   = await service.getCharacteristic(BLE_TX_CHAR);

    try {
      this.rxChar = await service.getCharacteristic(BLE_RX_CHAR);
    } catch (_) {
      // RX char optional — only needed for sending config to device
    }

    await this.txChar.startNotifications();
    this.txChar.addEventListener('characteristicvaluechanged', (e) => this._parse(e));

    this.connected = true;
    this.onStatus('connected', this.device.name || 'ZLEEP');
  }

  async disconnect() {
    if (this.device?.gatt?.connected) {
      await this.device.gatt.disconnect();
    }
    this._onDisconnected();
  }

  // Send config command to device (e.g. sampling rate)
  async sendCommand(cmd) {
    if (!this.rxChar) return;
    const enc = new TextEncoder().encode(cmd + '\n');
    await this.rxChar.writeValue(enc);
  }

  _parse(event) {
    const v = event.target.value;
    if (v.byteLength < 12) return;

    const imu = {
      ax: v.getInt16(0,  true) / 100,
      ay: v.getInt16(2,  true) / 100,
      az: v.getInt16(4,  true) / 100,
      gx: v.getInt16(6,  true) / 100,
      gy: v.getInt16(8,  true) / 100,
      gz: v.getInt16(10, true) / 100,
      ts: Date.now()
    };
    this.onData(imu);
  }

  _onDisconnected() {
    this.connected = false;
    this.txChar = null;
    this.rxChar = null;
    this.server = null;
    this.onStatus('disconnected', '');
  }
}
