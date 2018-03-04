/* eslint-disable */

const player = require('play-sound')();
player.play('output.wav', (err) => {
    if (err) console.log(`Could not play sound: ${err}`);
});

/* eslint-enable */
