class ZleepDatabase {
  constructor() {
    this.userId    = this._getOrCreateUserId();
    this.sessionId = null;
    this._realtimeRef = null;
  }

  _getOrCreateUserId() {
    let uid = localStorage.getItem('zleep_uid');
    if (!uid) {
      uid = 'user_' + Math.random().toString(36).slice(2, 10);
      localStorage.setItem('zleep_uid', uid);
    }
    return uid;
  }

  // ── SESSION ─────────────────────────────────────────────
  startSession(meta = {}) {
    const ref = db.ref(`users/${this.userId}/sessions`).push();
    this.sessionId = ref.key;
    ref.set({
      startTime: firebase.database.ServerValue.TIMESTAMP,
      status: 'active',
      ...meta
    });
    return this.sessionId;
  }

  endSession(summary = {}) {
    if (!this.sessionId) return;
    db.ref(`users/${this.userId}/sessions/${this.sessionId}`).update({
      endTime: firebase.database.ServerValue.TIMESTAMP,
      status: 'completed',
      ...summary
    });
    this.sessionId = null;
  }

  // ── IMU DATA ─────────────────────────────────────────────
  // Batch write every N seconds to avoid excessive DB writes
  pushImuSample(imu) {
    if (!this.sessionId) return;
    // Write to realtime path (overwrites — latest value only)
    db.ref(`realtime/${this.userId}/imu`).set(imu);
  }

  flushImuBatch(batch) {
    if (!this.sessionId || !batch.length) return;
    const summary = {
      count: batch.length,
      avgAx: _avg(batch, 'ax'), avgAy: _avg(batch, 'ay'), avgAz: _avg(batch, 'az'),
      maxMag: Math.max(...batch.map(s => Math.sqrt(s.ax**2 + s.ay**2 + s.az**2))),
      ts: Date.now()
    };
    db.ref(`users/${this.userId}/sessions/${this.sessionId}/batches`).push(summary);
  }

  // ── REALTIME SUBSCRIBE ────────────────────────────────────
  subscribeRealtime(cb) {
    this._realtimeRef = db.ref(`realtime/${this.userId}/imu`);
    this._realtimeRef.on('value', snap => { if (snap.val()) cb(snap.val()); });
  }

  unsubscribeRealtime() {
    if (this._realtimeRef) { this._realtimeRef.off(); this._realtimeRef = null; }
  }

  // ── HISTORY ──────────────────────────────────────────────
  getSessions(limit = 10) {
    return db.ref(`users/${this.userId}/sessions`)
      .orderByChild('startTime')
      .limitToLast(limit)
      .once('value')
      .then(snap => snap.val() || {});
  }

  // ── PROFILE ──────────────────────────────────────────────
  saveProfile(data) {
    return db.ref(`users/${this.userId}/profile`).update(data);
  }

  getProfile() {
    return db.ref(`users/${this.userId}/profile`).once('value').then(s => s.val() || {});
  }
}

function _avg(arr, key) {
  return arr.reduce((s, v) => s + v[key], 0) / arr.length;
}
