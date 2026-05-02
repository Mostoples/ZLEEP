class ZleepDatabase {
  constructor() {
    this._uid      = null;
    this.sessionId = null;
    this._realtimeRef = null;
  }

  setUid(uid) { this._uid = uid; }

  get uid() {
    // Fallback to localStorage UID for anonymous/guest users
    if (this._uid) return this._uid;
    let id = localStorage.getItem('zleep_uid');
    if (!id) { id = 'guest_' + Math.random().toString(36).slice(2, 10); localStorage.setItem('zleep_uid', id); }
    return id;
  }

  // ── Session ──────────────────────────────────────────────
  startSession(meta = {}) {
    const ref = db.ref(`users/${this.uid}/sessions`).push();
    this.sessionId = ref.key;
    ref.set({ startTime: firebase.database.ServerValue.TIMESTAMP, status: 'active', ...meta });
    return this.sessionId;
  }

  endSession(summary = {}) {
    if (!this.sessionId) return;
    db.ref(`users/${this.uid}/sessions/${this.sessionId}`).update({
      endTime: firebase.database.ServerValue.TIMESTAMP, status: 'completed', ...summary
    });
    this.sessionId = null;
  }

  // ── IMU Realtime ─────────────────────────────────────────
  pushImuSample(imu) {
    db.ref(`realtime/${this.uid}/imu`).set(imu);
  }

  flushImuBatch(batch) {
    if (!this.sessionId || !batch.length) return;
    const summary = {
      count: batch.length,
      avgAx: _dbAvg(batch, 'ax'), avgAy: _dbAvg(batch, 'ay'), avgAz: _dbAvg(batch, 'az'),
      maxMag: Math.max(...batch.map(s => Math.sqrt(s.ax**2 + s.ay**2 + s.az**2))),
      ts: Date.now()
    };
    db.ref(`users/${this.uid}/sessions/${this.sessionId}/batches`).push(summary);
  }

  // ── Realtime subscribe ───────────────────────────────────
  subscribeRealtime(cb) {
    this._realtimeRef = db.ref(`realtime/${this.uid}/imu`);
    this._realtimeRef.on('value', snap => { if (snap.val()) cb(snap.val()); });
  }
  unsubscribeRealtime() {
    if (this._realtimeRef) { this._realtimeRef.off(); this._realtimeRef = null; }
  }

  // ── History ──────────────────────────────────────────────
  getSessions(limit = 10) {
    return db.ref(`users/${this.uid}/sessions`)
      .orderByChild('startTime').limitToLast(limit)
      .once('value').then(s => s.val() || {});
  }

  // ── Profile ──────────────────────────────────────────────
  saveProfile(data) {
    return db.ref(`users/${this.uid}/profile`).update(data);
  }
  getProfile() {
    return db.ref(`users/${this.uid}/profile`).once('value').then(s => s.val() || {});
  }
}

function _dbAvg(arr, key) { return arr.reduce((s, v) => s + v[key], 0) / arr.length; }
