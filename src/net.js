// Networking: one interface, three transports.
//  - WavedashNet: Wavedash lobbies + WebRTC P2P mesh (production)
//  - LocalNet: BroadcastChannel between browser tabs (local testing without the platform)
//  - SoloNet: offline, you are the host
// Topology: the lobby host runs the authoritative simulation; everyone broadcasts their own movement.

import { MAX_PLAYERS } from './mapgen.js';

const CH_FAST = 0;      // unreliable: snapshots, player states
const CH_RELIABLE = 1;  // reliable: events, hits, welcome

const enc = new TextEncoder();
const dec = new TextDecoder();

class NetBase {
  constructor() {
    this.myId = 'me';
    this.myName = 'PLAYER';
    this.hostId = 'me';
    this.lobbyId = null;
    this.names = new Map();
    this.handlers = {};
    this.connected = new Set(); // peers with open channels
  }
  on(name, fn) { this.handlers[name] = fn; }
  emit(name, ...a) { const h = this.handlers[name]; if (h) h(...a); }
  isHost() { return this.hostId === this.myId; }
  nameOf(id) { return this.names.get(id) || 'PLAYER'; }
  get online() { return false; }
  poll() {}
  update() {}
  broadcast() {}
  sendTo() {}
  async leave() {}
  peerCount() { return this.connected.size; }
  setMeta() {}
  async list() { return []; }
  async inviteLink() { return null; }
  async host() { throw new Error('OFFLINE'); }
  async join() { throw new Error('OFFLINE'); }
}

export class SoloNet extends NetBase {
  constructor(name) {
    super();
    this.mode = 'solo';
    this.myId = 'solo';
    this.hostId = 'solo';
    this.myName = name;
    this.names.set(this.myId, name);
  }
}

export class WavedashNet extends NetBase {
  constructor(WD) {
    super();
    this.mode = 'wavedash';
    this.WD = WD;
    this.myId = WD.getUserId();
    this.myName = (WD.getUsername() || 'PLAYER').slice(0, 16);
    this.hostId = this.myId;
    this.names.set(this.myId, this.myName);
    this.maxPayload = 2048;
    this.inLobby = false;
    const E = WD.Events;
    WD.on(E.LOBBY_JOINED, (p) => {
      this.lobbyId = p.lobbyId;
      this.hostId = p.hostId || WD.getLobbyHostId(p.lobbyId) || this.myId;
      this.inLobby = true;
      for (const u of p.users || []) this.names.set(u.userId, (u.username || 'PLAYER').slice(0, 16));
      this.emit('joined', { lobbyId: p.lobbyId, hostId: this.hostId });
    });
    WD.on(E.LOBBY_USERS_UPDATED, (p) => {
      if (p.changeType === 'JOINED') this.names.set(p.userId, (p.username || 'PLAYER').slice(0, 16));
      if (p.changeType === 'LEFT') { this.connected.delete(p.userId); this.emit('peerLeft', p.userId); }
      this.checkHost();
    });
    WD.on(E.LOBBY_KICKED, () => { this.inLobby = false; this.emit('kicked'); });
    WD.on(E.P2P_CONNECTION_ESTABLISHED, (p) => {
      if (p.username) this.names.set(p.userId, p.username.slice(0, 16));
      this.connected.add(p.userId); this.emit('peerReady', p.userId);
    });
    WD.on(E.P2P_PEER_RECONNECTED, (p) => { this.connected.add(p.userId); this.emit('peerReady', p.userId); });
    WD.on(E.P2P_PEER_RECONNECTING, (p) => { this.connected.delete(p.userId); });
    WD.on(E.P2P_PEER_DISCONNECTED, (p) => { this.connected.delete(p.userId); });
    WD.on(E.P2P_CONNECTION_FAILED, (p) => { this.connected.delete(p.userId); });
    WD.on(E.LOBBY_INVITE, (p) => this.emit('invite', p));
    this.hostCheckTimer = 0;
  }

  setMaxPayload(n) { this.maxPayload = n; }
  get online() { return this.inLobby; }

  checkHost() {
    if (!this.lobbyId) return;
    const h = this.WD.getLobbyHostId(this.lobbyId);
    if (h && h !== this.hostId) {
      const old = this.hostId;
      this.hostId = h;
      this.emit('hostChanged', h, old);
    }
  }

  update(dt) {
    this.hostCheckTimer -= dt;
    if (this.hostCheckTimer <= 0) { this.hostCheckTimer = 1; this.checkHost(); }
  }

  async host() {
    const r = await this.WD.createLobby(this.WD.LobbyVisibility.PUBLIC, MAX_PLAYERS);
    if (!r || !r.success) throw new Error((r && r.message) || 'COULD NOT CREATE LOBBY');
    return r.data;
  }

  async join(lobbyId) {
    const r = await this.WD.joinLobby(lobbyId);
    if (!r || !r.success) throw new Error((r && r.message) || 'COULD NOT JOIN LOBBY');
  }

  async list() {
    const r = await this.WD.listAvailableLobbies(false);
    if (!r || !r.success) throw new Error((r && r.message) || 'COULD NOT LIST LOBBIES');
    return r.data.map((l) => ({
      id: l.lobbyId,
      count: l.playerCount, max: l.maxPlayers,
      label: String((l.metadata && l.metadata.label) || 'CRYPT RUN'),
      floor: Number((l.metadata && l.metadata.floor) || 1),
      members: String((l.metadata && l.metadata.members) || '').split(',').filter(Boolean),
    }));
  }

  setMeta(key, value) { if (this.lobbyId && this.isHost()) { try { this.WD.setLobbyData(this.lobbyId, key, value); } catch (e) { /* ignore */ } } }

  async inviteLink() {
    const r = await this.WD.getLobbyInviteLink(true);
    return r && r.success ? r.data : null;
  }

  async leave() {
    if (this.lobbyId) { const id = this.lobbyId; this.lobbyId = null; this.inLobby = false; try { await this.WD.leaveLobby(id); } catch (e) { /* ignore */ } }
    this.hostId = this.myId; this.connected.clear();
  }

  encode(msg) {
    const b = enc.encode(JSON.stringify(msg));
    if (b.length > this.maxPayload) { console.warn('[crypthop] dropping oversized message', msg.t, b.length); return null; }
    return b;
  }

  broadcast(msg, reliable) {
    if (!this.inLobby) return;
    const b = this.encode(msg); if (!b) return;
    this.WD.broadcastP2PMessage(reliable ? CH_RELIABLE : CH_FAST, !!reliable, b);
  }

  sendTo(id, msg, reliable) {
    if (!this.inLobby || id === this.myId) return;
    const b = this.encode(msg); if (!b) return;
    this.WD.sendP2PMessage(id, reliable ? CH_RELIABLE : CH_FAST, !!reliable, b);
  }

  poll() {
    if (!this.inLobby) return;
    for (const ch of [CH_RELIABLE, CH_FAST]) {
      for (let n = 0; n < 512; n++) {
        const m = this.WD.readP2PMessageFromChannel(ch);
        if (!m) break;
        let obj;
        try { obj = JSON.parse(dec.decode(m.payload)); } catch (e) { continue; }
        this.emit('message', m.fromUserId, obj);
      }
    }
  }
}

// BroadcastChannel transport so co-op can be tested with two local tabs (no platform needed).
export class LocalNet extends NetBase {
  constructor(name) {
    super();
    this.mode = 'local';
    this.myId = 'L' + Math.random().toString(36).slice(2, 10);
    this.myName = name;
    this.names.set(this.myId, name);
    this.hostId = this.myId;
    this.bc = new BroadcastChannel('crypthop-local');
    this.lobbies = new Map(); // id -> { hostId, users, seen }
    this.members = new Map(); // id -> lastSeen (for current lobby)
    this.queue = [];
    this.bc.onmessage = (e) => this.onRaw(e.data);
    this.beat = 0;
  }
  get online() { return !!this.lobbyId; }

  onRaw(d) {
    if (!d || d.from === this.myId) return;
    if (d.k === 'lobby') { this.lobbies.set(d.lobbyId, { hostId: d.hostId, count: d.count, floor: d.floor, members: Array.isArray(d.members) ? d.members : [], seen: performance.now() }); }
    if (!this.lobbyId || d.lobbyId !== this.lobbyId) return;
    if (d.k === 'hb' || d.k === 'join') {
      const isNew = !this.members.has(d.from);
      this.members.set(d.from, { seen: performance.now(), joinedAt: d.joinedAt });
      this.names.set(d.from, d.name);
      if (isNew) { this.connected.add(d.from); this.emit('peerReady', d.from); this.sendRaw({ k: 'hb', name: this.myName, joinedAt: this.joinedAt }); }
    } else if (d.k === 'bye') {
      this.dropMember(d.from);
    } else if (d.k === 'msg') {
      if (d.to && d.to !== this.myId) return;
      this.queue.push([d.from, d.data]);
    }
  }

  sendRaw(o) { o.from = this.myId; o.lobbyId = o.lobbyId || this.lobbyId; this.bc.postMessage(o); }

  dropMember(id) {
    if (!this.members.has(id)) return;
    this.members.delete(id); this.connected.delete(id);
    this.emit('peerLeft', id);
    this.electHost();
  }

  electHost() {
    // host = the earliest joiner still present
    let best = this.myId, bt = this.joinedAt;
    for (const [id, m] of this.members) if (m.joinedAt < bt || (m.joinedAt === bt && id < best)) { best = id; bt = m.joinedAt; }
    if (best !== this.hostId) { const old = this.hostId; this.hostId = best; this.emit('hostChanged', best, old); }
  }

  async host() {
    this.lobbyId = 'LOCAL-' + Math.random().toString(36).slice(2, 6).toUpperCase();
    this.joinedAt = Date.now();
    this.hostId = this.myId;
    this.emit('joined', { lobbyId: this.lobbyId, hostId: this.myId });
    return this.lobbyId;
  }

  async join(lobbyId) {
    const l = this.lobbies.get(lobbyId);
    if (!l) throw new Error('LOBBY NOT FOUND');
    this.lobbyId = lobbyId;
    this.joinedAt = Date.now();
    this.hostId = l.hostId;
    this.sendRaw({ k: 'join', name: this.myName, joinedAt: this.joinedAt });
    this.emit('joined', { lobbyId, hostId: l.hostId });
  }

  async list() {
    const now = performance.now();
    return [...this.lobbies.entries()].filter(([, l]) => now - l.seen < 2500)
      .map(([id, l]) => ({ id, count: l.count, max: MAX_PLAYERS, label: 'LOCAL TAB RUN', floor: l.floor || 1, members: l.members || [] }));
  }

  setMeta(key, value) { if (key === 'floor') this.floorMeta = value; }
  async inviteLink() { return null; }

  async leave() {
    if (this.lobbyId) this.sendRaw({ k: 'bye' });
    this.lobbyId = null; this.members.clear(); this.connected.clear(); this.hostId = this.myId;
  }

  update(dt) {
    this.beat -= dt;
    if (this.beat <= 0) {
      this.beat = 0.5;
      if (this.lobbyId) {
        this.sendRaw({ k: 'hb', name: this.myName, joinedAt: this.joinedAt });
        if (this.isHost()) this.sendRaw({ k: 'lobby', hostId: this.myId, count: this.members.size + 1, floor: this.floorMeta || 1, members: [this.myId, ...this.members.keys()] });
        const now = performance.now();
        for (const [id, m] of [...this.members]) if (now - m.seen > 3000) this.dropMember(id);
      }
    }
  }

  broadcast(msg) { if (this.lobbyId) this.sendRaw({ k: 'msg', data: msg }); }
  sendTo(id, msg) { if (this.lobbyId && id !== this.myId) this.sendRaw({ k: 'msg', to: id, data: msg }); }

  poll() {
    const q = this.queue; this.queue = [];
    for (const [from, data] of q) this.emit('message', from, data);
  }
}
