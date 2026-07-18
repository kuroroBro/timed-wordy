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

// By default rooms use the free public PeerJS broker. `?broker=host:port`
// points at a self-hosted peerjs-server instead (also how we test offline).
function peerOptions() {
  const broker = new URLSearchParams(window.location.search).get('broker');
  if (!broker) return { debug: 0 };
  const [host, port] = broker.split(':');
  return {
    host,
    port: Number(port) || (window.location.protocol === 'https:' ? 443 : 80),
    path: '/',
    secure: window.location.protocol === 'https:',
    debug: 0,
  };
}

// Host a room. Calls:
//   onAction(action, team) — a client pressed a button (team: its assigned
//                            team index in two-device mode, or null = spectator)
//   onPeers(count)         — connected device count changed
//   onError(message)       — fatal room error (room keeps out of the game's way)
// Resolves to { code, broadcast(msg), close() }.
// The host device is always team 0. The first client's private resume token
// owns team 1 for the room lifetime; reconnecting with that token reclaims
// the team while other clients remain spectators.
export function hostRoom({ onAction, onPeers, onError }, attempt = 0) {
  return new Promise((resolve, reject) => {
    if (peerUnavailable()) {
      reject(new Error('Room service failed to load. Check your connection and reload.'));
      return;
    }
    const code = randomCode();
    const peer = new Peer(ID_PREFIX + code, peerOptions());
    const conns = []; // join order matters: conns[0] is team 1
    let teamOneToken = null;
    let settled = false;

    function assignRoles() {
      const holder = [...conns].reverse().find((c) => c._resumeToken && c._resumeToken === teamOneToken);
      conns.forEach((c) => {
        const team = c === holder ? 1 : null;
        if (c._team !== team) {
          c._team = team;
          if (c.open) c.send(JSON.stringify({ t: 'role', team }));
        }
      });
      onPeers(conns.length, !!holder);
    }

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
      conn._team = undefined;
      conn.on('open', () => {
        conns.push(conn);
      });
      conn.on('data', (data) => {
        try {
          const msg = JSON.parse(data);
          if (msg && msg.t === 'hello' && typeof msg.resumeToken === 'string' && msg.resumeToken) {
            conn._resumeToken = msg.resumeToken;
            if (!teamOneToken) teamOneToken = msg.resumeToken;
            assignRoles();
          } else if (msg && msg.t === 'action') onAction(msg.a, conn._team ?? null);
          else if (msg && msg.t === 'bye') drop(); // explicit goodbye beats slow ICE timeouts
        } catch { /* ignore malformed input from strangers */ }
      });
      const drop = () => {
        const i = conns.indexOf(conn);
        if (i === -1) return;
        conns.splice(i, 1);
        assignRoles();
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
//   onRole(team)            — this device's team index (or null = spectator)
//   onClose(message)        — connection ended
// Resolves to { send(action), close() }.
export function joinRoom(code, { resumeToken, onState, onRole, onClose }) {
  return new Promise((resolve, reject) => {
    if (peerUnavailable()) {
      reject(new Error('Room service failed to load. Check your connection and reload.'));
      return;
    }
    const peer = new Peer(peerOptions());
    let settled = false;

    peer.on('open', () => {
      const conn = peer.connect(ID_PREFIX + normalizeCode(code), { reliable: true });
      conn.on('open', () => {
        settled = true;
        conn.send(JSON.stringify({ t: 'hello', resumeToken }));
        // Closing the tab silently leaves the host waiting on an ICE timeout;
        // say goodbye so it can re-assign roles right away.
        window.addEventListener('pagehide', () => {
          try { conn.send(JSON.stringify({ t: 'bye' })); } catch { /* leaving anyway */ }
        });
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
          else if (msg && msg.t === 'role') onRole(msg.team);
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
