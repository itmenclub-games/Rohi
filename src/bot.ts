// @ts-nocheck
import { Bot, InlineKeyboard, session } from 'grammy';
import { db } from './db';

type SessionState = {
  step: string;
  data: Record<string, any>;
};

export interface BotContext {
  from?: any;
  session: SessionState;
}

export function createBot(token: string | undefined): Bot<BotContext> | null {
  if (!token) return null;

  const bot = new Bot<BotContext>(token);

  bot.use(
    session<BotContext, SessionState>({
      initial: (): SessionState => ({ step: 'IDLE', data: {} }),
    })
  );

  const menu = () =>
    new InlineKeyboard()
      .text('💰 Deposit', 'deposit')
      .text('💸 Redeem', 'redeem')
      .row()
      .text('🎮 Game Account', 'account')
      .text('🎁 Freeplay', 'freeplay')
      .row()
      .text('💳 Payment Methods', 'methods')
      .text('🎉 Bonus', 'bonus')
      .row()
      .text('📞 Support', 'support');

  async function upsertUser(ctx: BotContext) {
    const from = ctx.from!;
    return db.user.upsert({
      where: { telegramId: String(from.id) },
      update: { username: from.username },
      create: { telegramId: String(from.id), username: from.username },
    });
  }

  bot.command('start', async (ctx) => {
    ctx.session = { step: 'IDLE', data: {} };
    await ctx.reply('👋 Welcome to Rohi_RB_bot! Select an option:', {
      reply_markup: menu(),
    });
  });

  bot.callbackQuery('deposit', async (ctx) => {
    const methods = await db.paymentMethod.findMany({
      where: { active: true },
      orderBy: { sortOrder: 'asc' },
    });
    ctx.session = { step: 'DEP_METHOD', data: {} };
    await ctx.answer();
    const kb = new InlineKeyboard(
      methods.map((m) => [
        { text: `💳 ${m.name}`, callback_data: `dm:${m.id}` },
      ]) as any
    ).row().text('❌ Cancel', 'cancel');
    await ctx.editMessageText('Select your payment method:', { reply_markup: kb });
  });

  for (const x of ['redeem', 'account', 'freeplay']) {
    bot.callbackQuery(x, async (ctx) => {
      const step =
        x === 'redeem'
          ? 'RED_USER'
          : x === 'account'
            ? 'ACC_GAME'
            : 'FREE_USER';
      ctx.session = { step, data: {} };
      await ctx.answer();
      await ctx.reply(
        x === 'redeem'
          ? 'Game username enter:'
          : x === 'account'
            ? 'Select/game name enter:'
            : 'Game username enter:'
      );
    });
  }

  bot.callbackQuery(/^dm:/, async (ctx) => {
    const id = ctx.callbackQuery.data.slice(3);
    const m = await db.paymentMethod.findUnique({ where: { id } });
    ctx.session = { step: 'DEP_AMOUNT', data: { methodId: id } };
    await ctx.answer();
    await ctx.reply(
      `💳 ${m?.name}\nAccount: ${m?.accountName}\nTag: ${m?.accountNo}\nMinimum: $${m?.minAmount}\n\nEnter amount:`
    );
  });

  bot.callbackQuery('methods', async (ctx) => {
    const ms = await db.paymentMethod.findMany({
      where: { active: true },
      orderBy: { sortOrder: 'asc' },
    });
    await ctx.answer();
    await ctx.reply(
      ms.length
        ? ms.map((m) => `💳 ${m.name}: ${m.accountName} / ${m.accountNo}`).join('\n')
        : 'Payment methods are being updated.'
    );
  });

  bot.callbackQuery('bonus', (ctx) =>
    ctx.reply('🎉 Current bonuses are announced by staff.')
  );

  bot.callbackQuery('support', (ctx) =>
    ctx.reply('📞 Please send your question here; staff will respond.')
  );

  bot.callbackQuery('cancel', async (ctx) => {
    ctx.session = { step: 'IDLE', data: {} };
    await ctx.answer();
    await ctx.reply('Cancelled.', { reply_markup: menu() });
  });

  bot.on('message:text', async (ctx) => {
    const s = ctx.session;
    const t = ctx.message.text;
    const u = await upsertUser(ctx);

    if (s.step === 'DEP_AMOUNT') {
      const n = Number(t);
      const m = await db.paymentMethod.findUnique({ where: { id: s.data.methodId } });
      if (!Number.isFinite(n) || n < (m?.minAmount || 0)) {
        return ctx.reply(`Enter a valid amount (minimum $${m?.minAmount || 0}).`);
      }
      s.data.amount = n;
      s.step = 'DEP_SCREEN';
      return ctx.reply('📸 Please send your payment screenshot.');
    }

    if (s.step === 'RED_USER' || s.step === 'FREE_USER') {
      s.data.username = t;
      s.step = s.step === 'RED_USER' ? 'RED_GAME' : 'FREE_GAME';
      return ctx.reply('Game name enter:');
    }

    if (s.step === 'RED_GAME' || s.step === 'FREE_GAME') {
      s.data.game = t;
      s.step = s.step === 'RED_GAME' ? 'RED_AMOUNT' : 'READY';
      if (s.step === 'RED_AMOUNT') return ctx.reply('Redeem amount enter:');
    }

    if (s.step === 'RED_AMOUNT') {
      const n = Number(t);
      if (!Number.isFinite(n) || n <= 0) return ctx.reply('Enter a valid amount.');
      s.data.amount = n;
      s.step = 'RED_METHOD';
      return ctx.reply('Payout method and account/tag enter:');
    }

    if (s.step === 'RED_METHOD') {
      const [method, ...rest] = t.split(' ');
      const r = await db.redeemRequest.create({
        data: {
          requestNo: `R-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          userId: u.id,
          gameUsername: s.data.username,
          gameName: s.data.game,
          amount: s.data.amount,
          payoutMethod: method,
          payoutAccount: rest.join(' '),
        },
      });
      s.step = 'IDLE';
      return ctx.reply(`✅ Redeem ${r.requestNo} submitted.`, { reply_markup: menu() });
    }

    if (s.step === 'READY') {
      const r = await db.freeplayRequest.create({
        data: {
          requestNo: `F-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          userId: u.id,
          gameUsername: s.data.username,
          gameName: s.data.game,
        },
      });
      s.step = 'IDLE';
      return ctx.reply(`✅ Freeplay ${r.requestNo} submitted.`, { reply_markup: menu() });
    }

    if (s.step === 'ACC_GAME') {
      s.data.game = t;
      s.step = 'ACC_USER';
      return ctx.reply('Preferred username enter:');
    }

    if (s.step === 'ACC_USER') {
      const r = await db.gameAccountRequest.create({
        data: {
          requestNo: `A-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          userId: u.id,
          gameName: s.data.game,
          preferredUsername: t,
        },
      });
      s.step = 'IDLE';
      return ctx.reply(`✅ Account request ${r.requestNo} submitted.`, { reply_markup: menu() });
    }
  });

  bot.on('message:photo', async (ctx) => {
    if (ctx.session.step !== 'DEP_SCREEN') return;
    const u = await upsertUser(ctx);
    const r = await db.depositRequest.create({
      data: {
        requestNo: `D-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        userId: u.id,
        methodId: ctx.session.data.methodId,
        amount: ctx.session.data.amount,
        screenshot: ctx.message.photo.at(-1)!.file_id,
      },
    });
    ctx.session = { step: 'IDLE', data: {} };
    await ctx.reply(`✅ Deposit ${r.requestNo} submitted.`, { reply_markup: menu() });
  });

  bot.catch((e) => console.error(e));
  return bot;
}
