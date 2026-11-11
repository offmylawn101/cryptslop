// Friends and recent players, kept on this device. Hosts publish their lobby's member ids, so the
// FRIENDS screen can show which friends are in an open run right now and join them in one click.
const KEY = 'crypthop.friends';

export class Friends {
  constructor() { this.load(); }

  load() {
    this.friends = [];  // { id, name, added }
    this.recent = [];   // { id, name, seen }
    try {
      const d = JSON.parse(localStorage.getItem(KEY) || '{}');
      this.friends = Array.isArray(d.friends) ? d.friends : [];
      this.recent = Array.isArray(d.recent) ? d.recent : [];
    } catch (e) { /* fresh start */ }
  }

  save() { try { localStorage.setItem(KEY, JSON.stringify({ friends: this.friends, recent: this.recent })); } catch (e) { /* ignore */ } }

  isFriend(id) { return this.friends.some((f) => f.id === id); }

  add(id, name) {
    if (!id || this.isFriend(id)) return false;
    this.friends.push({ id, name: String(name || 'PLAYER').slice(0, 16), added: Date.now() });
    this.friends.sort((a, b) => a.name.localeCompare(b.name));
    this.save();
    return true;
  }

  remove(id) {
    const n = this.friends.length;
    this.friends = this.friends.filter((f) => f.id !== id);
    if (this.friends.length !== n) { this.save(); return true; }
    return false;
  }

  // everyone you share a lobby with is remembered (newest first, 30 max); friends' names stay fresh
  noteRecent(id, name) {
    if (!id) return;
    name = String(name || 'PLAYER').slice(0, 16);
    this.recent = [{ id, name, seen: Date.now() }, ...this.recent.filter((r) => r.id !== id)].slice(0, 30);
    const f = this.friends.find((q) => q.id === id);
    if (f) f.name = name;
    this.save();
  }

  // which open lobbies have friends in them: [{ friend, lobby }]
  whereAre(lobbies) {
    const out = [];
    for (const f of this.friends) {
      const l = lobbies.find((q) => Array.isArray(q.members) && q.members.includes(f.id));
      if (l) out.push({ friend: f, lobby: l });
    }
    return out;
  }
}

// pick the lobby PLAY should drop you into: the busiest one with room (friends first), lowest floor on ties
export function pickLobby(lobbies, friends) {
  const open = lobbies.filter((l) => l.count > 0 && l.count < l.max);
  const score = (l) => (friends && Array.isArray(l.members) && l.members.some((id) => friends.isFriend(id)) ? 1000 : 0) + l.count;
  open.sort((a, b) => score(b) - score(a) || a.floor - b.floor);
  return open[0] || null;
}
