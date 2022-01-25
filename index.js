'use strict';

// Native
const EventEmitter = require('events');

// Packages
const HID = require('node-hid');
HID.setDriverType('libusb');

const NUM_KEYS = 15;
const NUM_KEYS_PER_ROW = 5;
const PAGE_PACKET_SIZE = 8017;
const ICON_SIZE = 72;
const NUM_TOTAL_PIXELS = 72*72;

class Infinitton extends EventEmitter {
	/**
	 * The pixel size of an icon written to the Infinitton key.
	 *
	 * @readonly
	 */
	static get ICON_SIZE() {
		return ICON_SIZE;
	}

	/**
	 * The number of keys on the panel.
	 *
	 * @readonly
	 */
	static get NUM_KEYS() {
		return NUM_KEYS;
	}

	/**
	 * The number of keys per row on the panel.
	 *
	 * @readonly
	 */
	static get NUM_KEYS_PER_ROW() {
		return NUM_KEYS_PER_ROW;
	}


	/**
	 * Checks a value is a valid RGB value. A number between 0 and 255.
	 *
	 * @static
	 * @param {number} value The number to check
	 */
	static checkRGBValue(value) {
		if (value < 0 || value > 255) {
			throw new TypeError('Expected a valid color RGB value 0 - 255');
		}
	}

	/**
	 * Checks a keyIndex is a valid key for a device. A number between 0 and 14.
	 *
	 * @static
	 * @param {number} keyIndex The keyIndex to check
	 */
	static checkValidKeyIndex(keyIndex) {
		if (keyIndex < 0 || keyIndex > 14) {
			throw new TypeError('Expected a valid keyIndex 0 - 14');
		}
	}

	constructor(devicePath) {
		super();
		var self = this;

		if (typeof devicePath === 'undefined') {
			// Device path not provided, will then select any connected device.
			const devices = HID.devices();
			const connectedInfinittons = devices.filter(device => {
				return device.vendorId === 0xffff && device.productId === 0x1f40;
			});
			if (!connectedInfinittons.length) {
				throw new Error('No Infinittons are connected.');
			}
			this.device = new HID.HID(connectedInfinittons[0].path);
		} else {
			this.device = new HID.HID(devicePath);
		}

		this.keyState = new Array(NUM_KEYS).fill(false);

		function keyIsPressed(keyIndex, keyPressed) {
			const stateChanged = keyPressed !== self.keyState[keyIndex];
			if (stateChanged) {
				self.keyState[keyIndex] = keyPressed;
				if (keyPressed) {
					self.emit('down', keyIndex);
				} else {
					self.emit('up', keyIndex);
				}
			}
		}

		this.device.on('data', data => {

			// Row 1
			keyIsPressed(4, data[1] & 0x10);
			keyIsPressed(3, data[1] & 0x08);
			keyIsPressed(2, data[1] & 0x04);
			keyIsPressed(1, data[1] & 0x02);
			keyIsPressed(0, data[1] & 0x01);

			// Row 2
			keyIsPressed(9, data[2] & 0x02);
			keyIsPressed(8, data[2] & 0x01);
			keyIsPressed(7, data[1] & 0x80);
			keyIsPressed(6, data[1] & 0x40);
			keyIsPressed(5, data[1] & 0x20);

			// Row 3
			keyIsPressed(14, data[2] & 0x40);
			keyIsPressed(13, data[2] & 0x20);
			keyIsPressed(12, data[2] & 0x10);
			keyIsPressed(11, data[2] & 0x08);
			keyIsPressed(10, data[2] & 0x04);
		});

		this.device.on('error', err => {
			this.emit('error', err);
		});
	}

	/**
	 * Fills the given key with a solid color.
	 *
	 * @param {number} keyIndex The key to fill 0 - 14
	 * @param {number} r The color's red value. 0 - 255
	 * @param {number} g The color's green value. 0 - 255
	 * @param {number} b The color's blue value. 0 -255
	 */
	fillColor(keyIndex, r, g, b) {
		Infinitton.checkValidKeyIndex(keyIndex);

		Infinitton.checkRGBValue(r);
		Infinitton.checkRGBValue(g);
		Infinitton.checkRGBValue(b);

		const pixel = Buffer.from([b, g, r]);
		this._writePixelData(keyIndex, Buffer.alloc(15552, pixel))
	}

	/**
	 * Fills the given key with an image in a Buffer.
	 *
	 * @param {number} keyIndex The key to fill 0 - 14
	 * @param {Buffer} imageBuffer
	 */
	fillImage(keyIndex, imageBuffer) {
		Infinitton.checkValidKeyIndex(keyIndex);

		if (imageBuffer.length !== 15552) {
			throw new RangeError(`Expected image buffer of length 15552, got length ${imageBuffer.length}`);
		}

		this._fillImageInner(keyIndex, imageBuffer, 72 * 3, 0)

	}
	/**
	 * Fills the panel with an image in a Buffer.
	 *
	 * @param {Buffer} imageBuffer
	 */
	fillPanelImage(imageBuffer) {
		if (imageBuffer.length !== 15552 * NUM_KEYS) {
			throw new RangeError(`Expected image buffer of length ${15552 * NUM_KEYS}, got length ${imageBuffer.length}`);
		}

		const iconSize = ICON_SIZE * 3
		const stride = iconSize * NUM_KEYS_PER_ROW

		for (let row = 0; row < NUM_KEYS / NUM_KEYS_PER_ROW; row++) {
			const rowOffset = stride * row * this.ICON_SIZE

			for (let column = 0; column < NUM_KEYS_PER_ROW; column++) {
				const index = row * NUM_KEYS_PER_ROW + column

				const colOffset = column * iconSize
					
				this._fillImageInner(index, imageBuffer, stride, rowOffset + colOffset)
			}
		}
	}

	_fillImageInner(keyIndex, imageBuffer, stride, offset) {
		const byteBuffer = Buffer.alloc(15552)
		
		for (let y = 0; y < 72; y++) {
			const rowOffset = 72 * 3 * y
			for (let x = 0; x < 72; x++) {
				const x2 = 72 - x - 1
				const srcOffset = y2 * stride + offset + x2 * 3

				const red = imageBuffer.readUInt8(srcOffset)
				const green = imageBuffer.readUInt8(srcOffset + 1)
				const blue = imageBuffer.readUInt8(srcOffset + 2)

				const targetOffset = rowOffset + x * 3
				byteBuffer.writeUInt8(blue, targetOffset)
				byteBuffer.writeUInt8(green, targetOffset + 1)
				byteBuffer.writeUInt8(red, targetOffset + 2)
			}
		}

		this._writePixelData(keyIndex, byteBuffer)
	}

	/**
	 * Clears the given key.
	 *
	 * @param {number} keyIndex The key to clear 0 - 14
	 * @returns {undefined}
	 */
	clearKey(keyIndex) {
		Infinitton.checkValidKeyIndex(keyIndex);

		this._writePixelData(keyIndex, Buffer.alloc(15552))
	}

	/**
	 * Clears all keys.
	 *
	 * returns {undefined}
	 */
	clearAllKeys() {
		const buffer = Buffer.alloc(15552)
		for (let keyIndex = 0; keyIndex < NUM_KEYS; keyIndex++) {
			this._writePixelData(keyIndex, buffer)
		}
	}

	/**
	 * Sets the brightness of the keys on the Infinitton
	 *
	 * @param {number} percentage The percentage brightness
	 */
	setBrightness(percentage) {
		if (percentage < 0 || percentage > 100) {
			throw new RangeError('Expected brightness percentage to be between 0 and 100');
		}

		const brightnessCommandBuffer = Buffer.from([0x00, 0x11, percentage]);
		this.device.sendFeatureReport(brightnessCommandBuffer);
	}

	close() {
		this.device.close()
	}

	/**
	 * Writes Infinitton's pixel data to the Infinitton.
	 *
	 * @private
	 * @param {number} keyIndex The key to write to 0 - 14
	 * @param {Buffer} buffer Image data for the button
	 * @returns {undefined}
	 */
	_writePixelData(keyIndex, pixels) {
		const firstPagePixels = pixels.slice(0, 7946);
		const secondPagePixels = pixels.slice(7946, NUM_TOTAL_PIXELS * 3);
		this._writePage1(keyIndex, firstPagePixels);
		this._writePage2(keyIndex, secondPagePixels);

		this.device.sendFeatureReport(Buffer.from([
			0, 0x12, 0x01, 0x00, 0x00, keyIndex + 1, 0x00, 0x00,
			0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
			0x00, 0xf6, 0x3c, 0x00, 0x00, 0x00, 0x00, 0x00,
			0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
			0x00, 0x00
		]));
	}

	/**
	 * Writes Infinitton's page 1 headers and image data to the Infinitton.
	 *
	 * @private
	 * @param {number} keyIndex The key to write to 0 - 14
	 * @param {Buffer} buffer Image data for page 1
	 * @returns {undefined}
	 */
	_writePage1(keyIndex, buffer) {
		const header = Buffer.from([
			0x02, 0x00, 0x00, 0x00, 0x00, 0x40, 0x1f, 0x00, 0x00, 0x55, 0xaa, 0xaa, 0x55, 0x11, 0x22, 0x33,
			0x44, 0x42, 0x4d, 0xf6, 0x3c, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x36, 0x00, 0x00, 0x00, 0x28,
			0x00, 0x00, 0x00, 0x48, 0x00, 0x00, 0x00, 0x48, 0x00, 0x00, 0x00, 0x01, 0x00, 0x18, 0x00, 0x00,
			0x00, 0x00, 0x00, 0xc0, 0x3c, 0x00, 0x00, 0x13, 0x0b, 0x00, 0x00, 0x13, 0x0b, 0x00, 0x00, 0x00,
			0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
		]);

		const packet = Buffer.alloc(PAGE_PACKET_SIZE)
		header.copy(packet, 0)
		buffer.copy(packet, header.length, 0, Math.min(PAGE_PACKET_SIZE - header.length, buffer.length))
		
		return this.device.write(packet);
	}

	/**
	 * Writes Infinitton's page 2 headers and image data to the Infinitton.
	 *
	 * @private
	 * @param {number} keyIndex The key to write to 0 - 14
	 * @param {Buffer} buffer Image data for page 2
	 * @returns {undefined}
	 */

	_writePage2(keyIndex, buffer) {
		const header = Buffer.from([
			0x02, 0x40, 0x1f, 0x00, 0x00, 0xb6, 0x1d, 0x00, 0x00, 0x55, 0xaa, 0xaa, 0x55, 0x11, 0x22, 0x33, 0x44
		]);

		const packet = Buffer.alloc(PAGE_PACKET_SIZE)
		header.copy(packet, 0)
		buffer.copy(packet, header.length, 0, Math.min(PAGE_PACKET_SIZE - header.length, buffer.length))

		return this.device.write(packet);
	}
}

module.exports = Infinitton;
