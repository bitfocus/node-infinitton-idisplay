# infinitton-idisplay

[`infinitton-idisplay`](https://github.com/bitfocus/node-elgato-stream-deck/tree/infinitton-idisplay) is a Node.js library for interfacing
with the [Elgato Stream Deck](https://www.infinitton.com/).

> ❗ Please note that `infinitton-idisplay` is NOT a standalone application. Instead, `infinitton-idevice` is a code library, which developers can use to make their own applications which interface with the Infinitton.

## References

This library is a modified version of [`elgato-stream-deck`](https://github.com/lange/node-elgato-stream-deck) that does not have dependencies to image libraries, and that talks to the Infinitton device instead of the Elgato Stream Deck.

## Install

`$ npm install --save infinitton-idisplay`

### Example

```javascript
const Infinitton = require('infinitton-idisplay');

// Automatically discovers connected Infinittons, and attaches to the first one.
// Throws if there are no connected Infinitton devices.
// You also have the option of providing the devicePath yourself as the first argument to the constructor.
// For example: const infinitton = new Infinitton('\\\\?\\hid#vid_ffff&pid_1f40&mi_00#7&56cf813&0&0000#{4d1e55b2-f16f-11cf-88cb-001111000030}')
// Device paths can be obtained via node-hid: https://github.com/node-hid/node-hid
const myInfinitton = new Infinitton();

myInfinitton.on('down', keyIndex => {
	console.log('key %d down', keyIndex);
});

myInfinitton.on('up', keyIndex => {
	console.log('key %d up', keyIndex);
});

// Fired whenever an error is detected by the `node-hid` library.
// Always add a listener for this event! If you don't, errors will be silently dropped.
myInfinitton.on('error', error => {
	console.error(error);
});

// Fill the first button form the left in the first row with a solid red color. This is synchronous.
myInfinitton.fillColor(4, 255, 0, 0);
console.log('Successfully wrote a red square to key 4.');
```
