import TelegramBot from "node-telegram-bot-api";
import { storage } from "./storage";

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  console.warn("TELEGRAM_BOT_TOKEN not found, bot will not start");
}

export function setupTelegramBot() {
  if (!token) return null;

  const bot = new TelegramBot(token, { polling: true });
  const waitingIdea = new Set<number>();
  const evaluationSessions = new Map<number, { ideas: any[], excellentId?: number, goodId?: number }>();

  bot.onText(/\/start/, async (msg: TelegramBot.Message) => {
    const chatId = msg.chat.id.toString();
    const username = msg.from?.username || msg.from?.first_name || "Unknown";
    await storage.trackTelegramUser(chatId, username);

    const firstName = msg.from?.first_name || "friend";
    bot.sendMessage(msg.chat.id, `Меню\n\nС какой целью вы здесь, ${firstName}?`, {
      reply_markup: {
        keyboard: [
          [{ text: "Написать идею" }, { text: "Вдохновение" }],
          [{ text: "Таблица лидеров" }],
          [{ text: "Статистика" }],
          [{ text: "Просто кнопка" }]
        ],
        resize_keyboard: true
      }
    });
  });

  bot.onText(/\/add/, async (msg: TelegramBot.Message) => {
    const settings = await storage.getSettings();
    if (!settings.botRunning) {
      return bot.sendMessage(msg.chat.id, "⛔ The Idea Box is currently closed.");
    }

    if (settings.hintText) {
      bot.sendMessage(msg.chat.id, `💡 Hint: ${settings.hintText}`);
    }
    bot.sendMessage(msg.chat.id, "Please send your idea as a reply to this message.");
  });

  bot.on("message", async (msg: TelegramBot.Message) => {
    if (!msg.text) return;
    const chatId = msg.chat.id.toString();
    const userId = msg.from?.id;
    const text = msg.text;

    const username = msg.from?.username || msg.from?.first_name || "Unknown";
    await storage.trackTelegramUser(chatId, username);

    // List of reserved button texts that shouldn't be treated as ideas
    const reservedButtons = ["Вдохновение", "Статистика", "Просто кнопка", "Написать идею", "Таблица лидеров"];

    if (text === "Написать идею") {
      if (userId) {
        const tgUserId = `tg-${userId}`;
        const lastIdea = await storage.getLastUserIdea(tgUserId);
        const settings = await storage.getSettings();
        
        if (lastIdea && lastIdea.createdAt) {
          const cooldownMs = 6 * 60 * 60 * 1000;
          const timeSinceLastIdea = Date.now() - new Date(lastIdea.createdAt).getTime();
          
          // Administrator bypass (Art)
          const isAdmin = userId === 6513687884 || msg.from?.username === "256dimik";

          if (timeSinceLastIdea < cooldownMs && !isAdmin) {
            const remainingMs = cooldownMs - timeSinceLastIdea;
            const hours = Math.floor(remainingMs / (60 * 60 * 1000));
            const minutes = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));
            
            return bot.sendMessage(chatId, `Вы можете отправлять 1 идею раз в 6 часов, чтобы сохранить высокое качество идей 💜. Поэтому тщательно подумайте, прежде чем написать свою идею. \n\n⏳ Тебе осталось подождать: ${hours}ч. ${minutes}мин.`);
          }
        }
        waitingIdea.add(userId);
        let msgText = "✍️ Напиши свою идею одним сообщением (максимум 200 символов):";
        if (settings.currentStage) {
          msgText += `\n\nТекущая тема:\n(${settings.currentStage})`;
        }
        return bot.sendMessage(chatId, msgText);
      }
    }

    // Handle specific buttons FIRST
    if (text === "Вдохновение") {
      if (userId) waitingIdea.delete(userId);
      return bot.sendMessage(chatId, "✨ Ищи вдохновение здесь:", {
        reply_markup: {
          inline_keyboard: [[{ text: "🔗 Генератор слов", url: "https://teoset.com/word-generator/lang.ru" }]]
        }
      });
    }

    if (text === "Таблица лидеров") {
      if (userId) waitingIdea.delete(userId);
      
      const archivedIdeas = await storage.getArchivedIdeas();
      const allIdeas = await storage.getIdeas();
      const top15 = allIdeas.slice(0, 15);
      
      let messageText = "";

      if (archivedIdeas.length > 0) {
        const medals = ["🥇", "🥈", "🥉"];
        const winnersText = archivedIdeas
          .map((idea, index) => `${medals[index] || "•"} *${idea.content}*\n└ ⭐ Баллы: ${idea.voteCount}`)
          .join("\n\n");
        messageText += `🏆 *Победители прошлого этапа:*\n\n${winnersText}\n\n` + "⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯\n\n";
      }

      if (top15.length === 0) {
        messageText += "📬 *Таблица лидеров пока пуста.*\nБудь первым, кто предложит идею!";
      } else {
        const leaderboardText = top15
          .map((idea, index) => `${index + 1}. ${idea.content} — ⭐ ${idea.voteCount}`)
          .join("\n");
        messageText += `📊 *Текущий топ-15:*\n\n${leaderboardText}\n\n_⭐ — баллы за идею_`;
      }

      return bot.sendMessage(chatId, messageText, { parse_mode: "Markdown" });
    }

    if (text === "Статистика") {
      if (userId) waitingIdea.delete(userId);
      const ideas = await storage.getIdeas();
      const totalPoints = ideas.reduce((acc, idea) => acc + (idea.voteCount || 0), 0);
      return bot.sendMessage(chatId, `📊 Статистика:\n\n💡 Всего идей: ${ideas.length}\n⭐ Всего баллов: ${totalPoints}`);
    }

    if (text === "Просто кнопка") {
      if (userId) waitingIdea.delete(userId);
      const images = [
        "attached_assets/5382134599816778747_1767856606563.jpg",
        "attached_assets/6AKF7JzqfSZTw27mJJH05IZhKwEzAB1dy9E8rxzCT2v87pQe_TS4Q2f__WqwDt_1767856606563.jpg",
        "attached_assets/n55p6xnb49en0ptymobxgomvcjbjkp0a_1767856606563.jpg",
        "attached_assets/5391014826953345974_1767856606563.jpg",
        "attached_assets/5210742220472913305_1767856606564.jpg",
        "attached_assets/v3bs9d64ce1a982ll833w5826xtr2ov0_1767856606564.jpg",
        "attached_assets/8awyaudedwfs00wea3ugkv4wr2fkh38t_1767856606564.jpg",
        "attached_assets/z7me81606t3hjxvbpu4elofy689e3ez5_1767856606565.jpg",
        "attached_assets/UrHed2ylkhE_1767856606565.jpg",
        "attached_assets/sk38aB3XCOQqHN9gmewwK1Aa-Nk3UDVyOJMnRNeDWNFV_Od9WGgbV_OV_LwHP5_1767856606565.jpg",
        "attached_assets/5395530701597250017_1767856606565.jpg",
        "attached_assets/52r6ob0k7hnxlf0qwmrjhscz4mgcwanz_1767856606565.png",
        "attached_assets/images_1767856606566.jpg",
        "attached_assets/5375156592220770099_1767856606566.jpg",
        "attached_assets/5373202635504161461_1767856606566.jpg",
        "attached_assets/VQahUDBynPQ7evF-1eMLUzUFHqMA6LCudPkh7dsIrCCussDQHanRegiS_NU7dv_1767856606566.jpg",
        "attached_assets/5386660112367292523_1767856606566.jpg",
        "attached_assets/RQNF7AsvRYlf_3zj4nXVIJVpCZZ3pP2pcrTtDnRp3qRq23n-ZURJR6I5_BqTq1_1767856606567.jpg",
        "attached_assets/ET1RlSIPcQa0fV9bC6h-d3eT8zrVkteUh-kHOTxF8V8krMO-QoRpRk6R_VyNOW_1767856606567.jpg",
        "attached_assets/5391153816390013040_1767856606567.jpg",
        "attached_assets/5386680706735475997_1767939417508.jpg",
        "attached_assets/5399995156892683923_1767939417508.jpg",
        "attached_assets/1767812580_1767939417508.jpg",
        "attached_assets/cover_1767939417508.jpg",
        "attached_assets/5393174980754869779_1767939417509.jpg",
        "attached_assets/5386680706735476544_1767939417509.jpg",
        "attached_assets/5371083876597437349_1767939417509.jpg",
        "attached_assets/5388932506549161536_1767939417509.jpg",
        "attached_assets/1767801780_1767939417510.jpg",
        "attached_assets/5388932506549161317_1767939417510.jpg",
        "attached_assets/mRR-bHgjGX5hx3dk9qdzqijubFS4TikEgeWI2yVpP9PZrih1Vc2vyjW7_aRzQG_1767939417510.jpg",
        "attached_assets/5384320287198874610_1767939417510.jpg",
        "attached_assets/5388932506549162209_1767939417510.jpg",
        "attached_assets/5388932506549161315_1767939417511.jpg",
        "attached_assets/5377581268763086768_1767939417511.jpg",
        "attached_assets/5395750307570060129_1767939417511.jpg",
        "attached_assets/5400346961958865940_1767939417511.jpg",
        "attached_assets/5393405616203698954_1767939417511.jpg",
        "attached_assets/niqci3czixpCc_9ZB8Lpu4VFTydS-DXXaViw5C66pRmVfHh8XC0zX-Az_1LwZ0_1767939417511.jpg",
        "attached_assets/5370589774969769538_1767939417512.jpg",
        "attached_assets/download_1767939504261.jpg",
        "attached_assets/1767794241_1767939504261.jpg",
        "attached_assets/c45l7ugugeaz9syhxraziiyil24ce17w_1767939504262.png",
        "attached_assets/xiv22FR7KE9kxf1PyYe2qqhtn37Ju7y_a4LnnH2rFpvxZnI2zXJiiRvS_h2Wv3_1767939504262.jpg",
        "attached_assets/r3LlFYp3zCNf7H9pMb-FZB1lwvcrPDJafWFM3IzxsNtmJDbKaylUBoky_rwrLb_1767939504262.jpg",
        "attached_assets/5391153816390012663_1767939504262.jpg",
        "attached_assets/5391014826953347527_1767939504263.jpg",
        "attached_assets/5397782501410934360_1767939504263.jpg",
        "attached_assets/5390953262892125460_1767939504263.jpg",
        "attached_assets/5391153816390012247_1767939504263.jpg",
        "attached_assets/1dn_cuymKhEUV3SsT125DovctmqUqr4nKnQNxHJMj_RpwSkcBZZvvzfR_2h2SC_1767939504263.jpg",
        "attached_assets/5382068487385189637_1767939504264.jpg",
        "attached_assets/1767784791_1767939504264.jpg",
        "attached_assets/5388914278707957479_1767939504264.jpg",
        "attached_assets/21_1767939504264.jpg",
        "attached_assets/15_1767939504264.jpg",
        "attached_assets/4i9y4ghcyus7e6tr45az7a8p9mwgyxw8_1767939504264.jpg",
        "attached_assets/5393405616203698785_1767939504265.jpg"
      ];
      const randomImage = images[Math.floor(Math.random() * images.length)];
      return bot.sendPhoto(chatId, randomImage);
    }

    if (userId && waitingIdea.has(userId) && !reservedButtons.includes(text)) {
      if (text.length > 200) {
        return bot.sendMessage(chatId, `⚠️ Твоя идея слишком длинная (${text.length} симв.). Пожалуйста, сократи её до 200 символов.`);
      }
      waitingIdea.delete(userId);
      
      const settings = await storage.getSettings();
      if (!settings.botRunning) {
        return bot.sendMessage(chatId, "⛔ The Idea Box is currently closed.");
      }

      try {
        const tgUserId = `tg-${userId}`;
        const totalOtherCount = await storage.getTotalOtherIdeasCount(tgUserId);
        const seenCount = await storage.getVotedCount(tgUserId);

        // Check if there are enough ideas to evaluate (at least 10)
        const unseen = await storage.getUnseenIdeas(tgUserId, 10);
        
        if (unseen.length >= 10) {
          evaluationSessions.set(userId, { ideas: unseen });
          const keyboard = unseen.map(idea => ([{
            text: idea.content.length > 30 ? idea.content.substring(0, 27) + "..." : idea.content,
            callback_data: `excellent_${idea.id}`
          }]));

          return bot.sendMessage(chatId, `⚠️ Сначала оцени 10 других идей!\n\n1️⃣ Выбери "Отличную идею" (+2 балла):`, {
            reply_markup: {
              inline_keyboard: keyboard
            }
          });
        }

        // If not enough ideas for a batch of 10, just allow submission (or handle differently)
        await storage.createIdea({
          content: text,
          userId: tgUserId,
          username: msg.from?.username || msg.from?.first_name || "TG User",
        });
        bot.sendMessage(chatId, "✅ Идея отправлена и сохранена! 💜");
      } catch (err) {
        bot.sendMessage(chatId, "❌ Не удалось сохранить идею. Попробуй позже.");
      }
      return;
    }

    // Original basic logic for other messages
    if (text.startsWith("/")) return;
  });

  bot.on("callback_query", async (query) => {
    if (!query.data || !query.message) return;
    const chatId = query.message.chat.id;
    const userId = query.from.id;
    const tgUserId = `tg-${userId}`;

    if (query.data.startsWith("excellent_")) {
      const ideaId = parseInt(query.data.split("_")[1]);
      const session = evaluationSessions.get(userId);
      if (!session) return;

      session.excellentId = ideaId;
      evaluationSessions.set(userId, session);

      const remainingIdeas = session.ideas.filter(i => i.id !== ideaId);
      const keyboard = remainingIdeas.map(idea => ([{
        text: idea.content.length > 30 ? idea.content.substring(0, 27) + "..." : idea.content,
        callback_data: `good_${idea.id}`
      }]));

      bot.answerCallbackQuery(query.id);
      if (query.message.message_id) {
        bot.deleteMessage(chatId, query.message.message_id).catch(() => {});
      }

      bot.sendMessage(chatId, `🌟 Выбрана отличная идея (+2).\n\n2️⃣ Теперь выбери "Хорошую идею" (+1 балл):`, {
        reply_markup: {
          inline_keyboard: keyboard
        }
      });
    } else if (query.data.startsWith("good_")) {
      const ideaId = parseInt(query.data.split("_")[1]);
      const session = evaluationSessions.get(userId);
      if (!session) return;

      session.goodId = ideaId;
      
      try {
        // Excellent: +2
        if (session.excellentId) {
          await storage.createVote(tgUserId, session.excellentId, 2);
        }
        // Good: +1
        await storage.createVote(tgUserId, ideaId, 1);
        
        // Mark others (0 points) so they aren't shown again
        const otherIds = session.ideas
          .filter(i => i.id !== session.excellentId && i.id !== ideaId)
          .map(i => i.id);
        
        for (const id of otherIds) {
          await storage.createVote(tgUserId, id, 0);
        }

        evaluationSessions.delete(userId);
        bot.answerCallbackQuery(query.id, { text: "Оценка завершена!" });
        
        if (query.message.message_id) {
          bot.deleteMessage(chatId, query.message.message_id).catch(() => {});
        }
        
        bot.sendMessage(chatId, "✅ Спасибо за оценку! Все 10 идей просмотрены. Теперь ты можешь попробовать написать свою идею снова.");
      } catch (err) {
        bot.answerCallbackQuery(query.id, { text: "Ошибка при сохранении оценок" });
      }
    }
  });

  console.log("Telegram bot started");
}
