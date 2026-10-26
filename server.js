'use strict';

const os = require('os');
const { createServer } = require('./src/server');
const { createState, normalizeCode } = require('./src/document');

const port = Number(process.env.PORT) || 8080;
const requested = process.env.CAST_CODE || '';
const configured = normalizeCode(requested);
const state = createState(configured || undefined);
const appId = process.env.CAST_APP_ID || '';

const server = createServer({ state: state, appId: appId });
server.listen(port, '0.0.0.0', () => {
  const urls = lanUrls(port);
  console.log('Kobo Cast receiver');
  console.log('Room code: ' + state.code);
  if (requested && !configured) {
    console.log('CAST_CODE was ignored. Use 4 to 12 letters or digits.');
  }
  console.log('On the Kobo Libra Colour, open:');
  for (let i = 0; i < urls.length; i += 1) console.log('  ' + urls[i] + '/');
  console.log('On your phone, open:');
  for (let i = 0; i < urls.length; i += 1) console.log('  ' + urls[i] + '/sender');
  if (appId) console.log('Google Cast app id: ' + appId);
});

function lanUrls(listenPort) {
  const found = [];
  const nets = os.networkInterfaces();
  const names = Object.keys(nets);
  for (let i = 0; i < names.length; i += 1) {
    const entries = nets[names[i]] || [];
    for (let j = 0; j < entries.length; j += 1) {
      const net = entries[j];
      const v4 = net.family === 'IPv4' || net.family === 4;
      if (!v4 || net.internal) continue;
      found.push('http://' + net.address + ':' + listenPort);
    }
  }
  if (!found.length) found.push('http://127.0.0.1:' + listenPort);
  return found;
}
