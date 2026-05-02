class ZleepAuth {
  constructor(onAuthChange) {
    this.auth = firebase.auth();
    this.user = null;
    this.onAuthChange = onAuthChange;

    this.auth.onAuthStateChanged(user => {
      this.user = user;
      this.onAuthChange(user);
    });
  }

  get uid() {
    return this.user ? this.user.uid : null;
  }

  get displayName() {
    if (!this.user) return 'Tamu';
    return this.user.displayName || this.user.email?.split('@')[0] || 'Pengguna';
  }

  get isAnonymous() {
    return this.user?.isAnonymous ?? true;
  }

  async loginEmail(email, password) {
    const cred = await this.auth.signInWithEmailAndPassword(email, password);
    return cred.user;
  }

  async registerEmail(email, password, name) {
    const cred = await this.auth.createUserWithEmailAndPassword(email, password);
    await cred.user.updateProfile({ displayName: name });
    return cred.user;
  }

  async loginAnonymous() {
    const cred = await this.auth.signInAnonymously();
    return cred.user;
  }

  // Upgrade anonymous → permanent account (data preserved)
  async upgradeAnonymous(email, password, name) {
    const credential = firebase.auth.EmailAuthProvider.credential(email, password);
    const cred = await this.user.linkWithCredential(credential);
    await cred.user.updateProfile({ displayName: name });
    return cred.user;
  }

  async logout() {
    await this.auth.signOut();
  }

  async resetPassword(email) {
    await this.auth.sendPasswordResetEmail(email);
  }
}
