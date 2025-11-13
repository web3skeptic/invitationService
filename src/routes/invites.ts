import express, { type Request, type Response } from 'express';
import { inviteDb } from '../database.js';
import { authMiddleware } from '../middleware/auth.js';
import { checkInviteOnChain } from '../contract.js';
import type { AddInviteRequest, CheckInviteRequest } from '../types.js';

const router = express.Router();

// POST /addInvite - Add new secret to the DB (auth required)
router.post('/addInvite', authMiddleware, (req: Request, res: Response): void => {
  try {
    const { secret, signer } = req.body as AddInviteRequest;

    if (!secret) {
      res.status(400).json({ error: 'Secret is required' });
      return;
    }

    if (!signer) {
      res.status(400).json({ error: 'Signer is required' });
      return;
    }

    // Validate that secret is a hex string
    if (!/^(0x)?[0-9a-fA-F]+$/.test(secret)) {
      res.status(400).json({ error: 'Secret must be a valid hex string' });
      return;
    }

    const invite = inviteDb.addInvite(secret, signer);

    res.status(201).json({
      success: true,
      invite: {
        id: invite.id,
        secret: invite.secret,
        signer: invite.signer,
        status: invite.status,
        updateDate: invite.updateDate
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
      res.status(409).json({ error: 'Secret already exists' });
      return;
    }

    console.error('Error adding invite:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /getInvite - Returns the next secret and updates status to pending
router.get('/getInvite', async (_req: Request, res: Response): Promise<void> => {
  try {
    const invite = inviteDb.getNextInvite();

    if (!invite) {
      res.status(404).json({ error: 'No available invites' });
      return;
    }

    // If the invite is pending, verify it's not actually used on-chain
    if (invite.status === 'pending') {
      try {
        const chainData = await checkInviteOnChain(invite.signer);

        if (chainData.claimed) {
          // Mark as used and try to get the next invite
          inviteDb.markInviteAsUsed(invite.secret);

          // Recursively call getNextInvite to find the next available one
          const nextInvite = inviteDb.getNextInvite();

          if (!nextInvite) {
            res.status(404).json({ error: 'No available invites' });
            return;
          }

          res.json({
            success: true,
            invite: {
              id: nextInvite.id,
              secret: nextInvite.secret,
              signer: nextInvite.signer,
              status: nextInvite.status,
              updateDate: nextInvite.updateDate
            }
          });
          return;
        }
      } catch (chainError) {
        console.warn('Warning: Could not verify pending invite on-chain:', chainError);
        // Continue and return the pending invite anyway if chain check fails
      }
    }

    res.json({
      success: true,
      invite: {
        id: invite.id,
        secret: invite.secret,
        signer: invite.signer,
        status: invite.status,
        updateDate: invite.updateDate
      }
    });
  } catch (error) {
    console.error('Error getting invite:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /checkInvite - Check if invite is used on-chain and update status
router.post('/checkInvite', async (req: Request, res: Response): Promise<void> => {
  try {
    const { secret, address } = req.body as CheckInviteRequest;

    if (!secret) {
      res.status(400).json({ error: 'Secret is required to verify the invite' });
      return;
    }

    if (!address) {
      res.status(400).json({ error: 'Signer address is required' });
      return;
    }

    const invite = inviteDb.getInviteBySecret(secret);

    if (!invite) {
      res.status(404).json({ error: 'Invite not found' });
      return;
    }

    if (invite.status === 'used') {
      res.json({
        success: true,
        isUsed: true,
        invite: {
          id: invite.id,
          secret: invite.secret,
          signer: invite.signer,
          status: invite.status,
          updateDate: invite.updateDate
        }
      });
      return;
    }

    // Check if invite is used on-chain via ReferralContract.accounts
    try {
      const chainData = await checkInviteOnChain(address);

      if (chainData.claimed) {
        // Mark as used in database
        inviteDb.markInviteAsUsed(secret);
        const updatedInvite = inviteDb.getInviteBySecret(secret);

        res.json({
          success: true,
          isUsed: true,
          invite: {
            id: updatedInvite!.id,
            secret: updatedInvite!.secret,
            signer: updatedInvite!.signer,
            status: 'used',
            updateDate: updatedInvite!.updateDate
          }
        });
        return;
      }

      // Not used on-chain, return current status
      res.json({
        success: true,
        isUsed: false,
        invite: {
          id: invite.id,
          secret: invite.secret,
          signer: invite.signer,
          status: invite.status,
          updateDate: invite.updateDate
        }
      });
    } catch (chainError) {
      console.error('Error checking on-chain status:', chainError);
      // If chain check fails, return server error
      res.status(500).json({ error: 'Failed to verify invite status on-chain' });
    }
  } catch (error) {
    console.error('Error checking invite:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
