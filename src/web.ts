// @ts-nocheck
import express from 'express';
import path from 'path';
import { db } from './db';

export function createApp(): { app: express.Application; port: number } {
  const app = express();
  app.use(express.json());
  app.use(express.static(path.join(__dirname, 'public')));

  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Unhandled error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  const adminPassword = process.env.ADMIN_PASSWORD || 'admin';

  function adminAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
    const token = req.headers['x-admin-token'];
    if (typeof token === 'string' && token === adminPassword) {
      return next();
    }
    res.status(401).json({ error: 'Unauthorized' });
  }

  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  app.get('/api/requests', async (_req, res) => {
    const [deposits, redeems, accounts, freeplays] = await Promise.all([
      db.depositRequest.findMany({ include: { user: true, method: true }, orderBy: { createdAt: 'desc' } }),
      db.redeemRequest.findMany({ include: { user: true }, orderBy: { createdAt: 'desc' } }),
      db.gameAccountRequest.findMany({ include: { user: true }, orderBy: { createdAt: 'desc' } }),
      db.freeplayRequest.findMany({ include: { user: true }, orderBy: { createdAt: 'desc' } }),
    ]);
    res.json({ deposits, redeems, accounts, freeplays });
  });

  app.post('/api/admin/login', (req, res) => {
    const { password } = req.body || {};
    if (password === adminPassword) {
      res.json({ token: adminPassword });
    } else {
      res.status(401).json({ error: 'Invalid password' });
    }
  });

  app.get('/api/admin/requests', adminAuth, async (req, res) => {
    const { type, status } = req.query as { type?: string; status?: string };
    const where: any = {};
    if (status) where.status = status;

    let data: any = {};
    if (!type || type === 'deposits') {
      data.deposits = await db.depositRequest.findMany({ where, include: { user: true, method: true }, orderBy: { createdAt: 'desc' } });
    }
    if (!type || type === 'redeems') {
      data.redeems = await db.redeemRequest.findMany({ where, include: { user: true }, orderBy: { createdAt: 'desc' } });
    }
    if (!type || type === 'accounts') {
      data.accounts = await db.gameAccountRequest.findMany({ where, include: { user: true }, orderBy: { createdAt: 'desc' } });
    }
    if (!type || type === 'freeplays') {
      data.freeplays = await db.freeplayRequest.findMany({ where, include: { user: true }, orderBy: { createdAt: 'desc' } });
    }
    res.json(data);
  });

  const updateStatus = async (model: any, id: string, status: string, rejectReason?: string) => {
    const data: any = { status };
    if (rejectReason !== undefined) data.rejectReason = rejectReason;
    return model.update({ where: { id }, data });
  };

  app.post('/api/admin/requests/deposits/:id/status', adminAuth, async (req, res) => {
    const id = req.params.id as string;
    const { status, rejectReason } = req.body || {};
    const r = await updateStatus(db.depositRequest, id, status, rejectReason);
    res.json(r);
  });

  app.post('/api/admin/requests/redeems/:id/status', adminAuth, async (req, res) => {
    const id = req.params.id as string;
    const { status } = req.body || {};
    const r = await updateStatus(db.redeemRequest, id, status);
    res.json(r);
  });

  app.post('/api/admin/requests/accounts/:id/status', adminAuth, async (req, res) => {
    const id = req.params.id as string;
    const { status } = req.body || {};
    const r = await updateStatus(db.gameAccountRequest, id, status);
    res.json(r);
  });

  app.post('/api/admin/requests/freeplays/:id/status', adminAuth, async (req, res) => {
    const id = req.params.id as string;
    const { status } = req.body || {};
    const r = await updateStatus(db.freeplayRequest, id, status);
    res.json(r);
  });

  app.get('/api/admin/methods', adminAuth, async (_req, res) => {
    const methods = await db.paymentMethod.findMany({ orderBy: { sortOrder: 'asc' } });
    res.json(methods);
  });

  app.post('/api/admin/methods', adminAuth, async (req, res) => {
    const { name, accountName, accountNo, minAmount, sortOrder } = req.body || {};
    const method = await db.paymentMethod.create({
      data: { name, accountName, accountNo, minAmount: Number(minAmount) || 10, sortOrder: Number(sortOrder) || 0, active: true },
    });
    res.json(method);
  });

  app.put('/api/admin/methods/:id', adminAuth, async (req, res) => {
    const id = req.params.id as string;
    const { name, accountName, accountNo, minAmount, sortOrder, active } = req.body || {};
    const method = await db.paymentMethod.update({
      where: { id },
      data: { name, accountName, accountNo, minAmount: Number(minAmount), sortOrder: Number(sortOrder), active: Boolean(active) },
    });
    res.json(method);
  });

  app.delete('/api/admin/methods/:id', adminAuth, async (req, res) => {
    const id = req.params.id as string;
    await db.paymentMethod.delete({ where: { id } });
    res.json({ ok: true });
  });

  app.get('/api/admin/games', adminAuth, async (_req, res) => {
    const games = await db.game.findMany({ orderBy: { sortOrder: 'asc' } });
    res.json(games);
  });

  app.post('/api/admin/games', adminAuth, async (req, res) => {
    const { name, sortOrder } = req.body || {};
    const game = await db.game.create({
      data: { name, sortOrder: Number(sortOrder) || 0, active: true },
    });
    res.json(game);
  });

  app.put('/api/admin/games/:id', adminAuth, async (req, res) => {
    const id = req.params.id as string;
    const { name, sortOrder, active } = req.body || {};
    const game = await db.game.update({
      where: { id },
      data: { name, sortOrder: Number(sortOrder), active: Boolean(active) },
    });
    res.json(game);
  });

  app.delete('/api/admin/games/:id', adminAuth, async (req, res) => {
    const id = req.params.id as string;
    await db.game.delete({ where: { id } });
    res.json({ ok: true });
  });

  return app;
}

export function startServer(app: express.Application, port: number) {
  const server = app.listen(port, '0.0.0.0', () => console.log(`Rohi live on port ${port}`));
  server.on('error', (e: any) => console.error('Server error:', e));
  return server;
}
