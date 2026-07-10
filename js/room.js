// One-room networking over WebRTC data channels via PeerJS.
// The host device is authoritative; clients send intents and render snapshots.
// Requires the PeerJS <script> tag (global `Peer`); every entry point fails
// soft with a readable error so local pass-the-phone play is never blocked.

const ID_PREFIX = 'xsec-room-';
// No lookalikes (0/O, 1/I/L) so codes survive being shouted across a room.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function randomCode(len = 4) {
  let code = '';
  for (let i = 0; i < len; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

export function normalizeCode(raw) {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function peerUnavailable() {
  return typeof window === 'undefined' || typeof window.Peer !== 'function';
}

// Host a room. Calls:
//   onAction(action)  — a client pressed a button
//   onPeers(count)    — connected device count changed
//   onError(message)  — fatal room error (room keeps out of the game's way)
// Resolves to { code, broadcast(msg), close() }.
export function hostRoom({ onAction, onPeers, onError }, attempt = 0) {
  return new Promise((resolve, reject) => {
    if (peerUnavailable()) {
      reject(new Error('Room service failed to load. Check your connection and reload.'));
      return;
    }
    const code = randomCode();
    const peer = new Peer(ID_PREFIX + code, { debug: 0 });
    const conns = new Set();
    let settled = false;

    peer.on('open', () => {
      settled = true;
      resolve({
        code,
        broadcast(msg) {
          const data = JSON.stringify(msg);
          for (const c of conns) {
            if (c.open) c.send(data);
          }
        },
        close() {
          peer.destroy();
        },
      });
    });

    peer.on('connection', (conn) => {
      conn.on('open', () => {
        conns.add(conn);
        onPeers(conns.size);
      });
      conn.on('data', (data) => {
        try {
          const msg = JSON.parse(data);
          if (msg && msg.t === 'action') onAction(msg.a);
        } catch { /* ignore malformed input from strangers */ }
      });
      const drop = () => {
        conns.delete(conn);
        onPeers(conns.size);
      };
      conn.on('close', drop);
      conn.on('error', drop);
    });

    peer.on('error', (err) => {
      if (!settled && err.type === 'unavailable-id' && attempt < 5) {
        // Code collision on the broker — roll a new one.
        peer.destroy();
        hostRoom({ onAction, onPeers, onError }, attempt + 1).then(resolve, reject);
      } else if (!settled) {
        peer.destroy();
        reject(new Error('Could not reach the room service. You can still play on this device.'));
      } else {
        onError('Room connection lost. The game continues on this device.');
      }
    });
  });
}

// Join a room by code. Calls:
//   onState(state, hostNow) — snapshot from the host
//   onClose(message)        — connection ended
// Resolves to { send(action), close() }.
export function joinRoom(code, { onState, onClose }) {
  return new Promise((resolve, reject) => {
    if (peerUnavailable()) {
      reject(new Error('Room service failed to load. Check your connection and reload.'));
      return;
    }
    const peer = new Peer({ debug: 0 });
    let settled = false;

    peer.on('open', () => {
      const conn = peer.connect(ID_PREFIX + normalizeCode(code), { reliable: true });
      conn.on('open', () => {
        settled = true;
        resolve({
          send(action) {
            if (conn.open) conn.send(JSON.stringify({ t: 'action', a: action }));
          },
          close() {
            peer.destroy();
          },
        });
      });
      conn.on('data', (data) => {
        try {
          const msg = JSON.parse(data);
          if (msg && msg.t === 'state') onState(msg.state, msg.hostNow);
        } catch { /* ignore */ }
      });
      conn.on('close', () => {
        if (settled) onClose('The host closed the room.');
        peer.destroy();
      });
    });

    peer.on('error', (err) => {
      peer.destroy();
      if (settled) {
        onClose('Room connection lost.');
      } else if (err.type === 'peer-unavailable') {
        reject(new Error(`No room found with code ${normalizeCode(code)}. Double-check it with the host.`));
      } else {
        reject(new Error('Could not reach the room service. Try again in a moment.'));
      }
    });
  });
}
