import Database from 'better-sqlite3';
import { InviteStatus, type Invite } from './types.js';

const db = new Database('invitations.db');

// Create the invites table
db.exec(`
  CREATE TABLE IF NOT EXISTS invites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    secret TEXT NOT NULL UNIQUE,
    signer TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'none',
    updateDate TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

// Create index on status for faster queries
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_status ON invites(status)
`);

export class InviteDatabase {

  // Add a new invite
  addInvite(secret: string, signer: string): Invite {
    const stmt = db.prepare(`
      INSERT INTO invites (secret, signer, status, updateDate)
      VALUES (?, ?, ?, datetime('now'))
    `);

    const result = stmt.run(secret, signer, InviteStatus.NONE);

    return this.getInviteById(Number(result.lastInsertRowid));
  }

  // Get an invite by ID
  getInviteById(id: number): Invite {
    const stmt = db.prepare('SELECT * FROM invites WHERE id = ?');
    const row = stmt.get(id) as Invite | undefined;

    if (!row) {
      throw new Error('Invite not found');
    }

    return row;
  }

  // Get the next available invite (prefer 'none', fallback to oldest 'pending')
  getNextInvite(): Invite | null {
    // First try to get an invite with status 'none'
    const stmtNone = db.prepare(`
      SELECT * FROM invites
      WHERE status = ?
      ORDER BY id ASC
      LIMIT 1
    `);

    const noneRow = stmtNone.get(InviteStatus.NONE) as Invite | undefined;

    if (noneRow) {
      // Update status to pending
      this.updateInviteStatus(noneRow.id, InviteStatus.PENDING);
      return this.getInviteById(noneRow.id);
    }

    // If no 'none' invites, get the oldest 'pending' invite
    const stmtPending = db.prepare(`
      SELECT * FROM invites
      WHERE status = ?
      ORDER BY updateDate ASC
      LIMIT 1
    `);

    const pendingRow = stmtPending.get(InviteStatus.PENDING) as Invite | undefined;

    if (!pendingRow) {
      return null;
    }

    return pendingRow;
  }

  // Get invite by secret
  getInviteBySecret(secret: string): Invite | null {
    const stmt = db.prepare('SELECT * FROM invites WHERE secret = ?');
    const row = stmt.get(secret) as Invite | undefined;

    return row || null;
  }

  // Update invite status
  updateInviteStatus(id: number, status: InviteStatus): void {
    const stmt = db.prepare(`
      UPDATE invites
      SET status = ?, updateDate = datetime('now')
      WHERE id = ?
    `);

    stmt.run(status, id);
  }

  // Mark invite as used by secret
  markInviteAsUsed(secret: string): boolean {
    const invite = this.getInviteBySecret(secret);

    if (!invite) {
      return false;
    }

    this.updateInviteStatus(invite.id, InviteStatus.USED);
    return true;
  }

  // Get all invites (for debugging/admin purposes)
  getAllInvites(): Invite[] {
    const stmt = db.prepare('SELECT * FROM invites ORDER BY id ASC');
    return stmt.all() as Invite[];
  }

  // Get invite statistics
  getInviteStats(): { total: number; used: number; pending: number; available: number } {
    const countStmt = db.prepare('SELECT COUNT(*) as count FROM invites');
    const totalRow = countStmt.get() as { count: number } | undefined;
    const total = totalRow?.count || 0;

    const usedStmt = db.prepare('SELECT COUNT(*) as count FROM invites WHERE status = ?');
    const usedRow = usedStmt.get(InviteStatus.USED) as { count: number } | undefined;
    const used = usedRow?.count || 0;

    const pendingStmt = db.prepare('SELECT COUNT(*) as count FROM invites WHERE status = ?');
    const pendingRow = pendingStmt.get(InviteStatus.PENDING) as { count: number } | undefined;
    const pending = pendingRow?.count || 0;

    const available = total - used - pending;

    return {
      total,
      used,
      pending,
      available,
    };
  }
}

export const inviteDb = new InviteDatabase();
