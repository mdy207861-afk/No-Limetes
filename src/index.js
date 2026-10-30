require('dotenv').config();

const {
  Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle, Events
} = require('discord.js');

const store = require('./store');
const { t, panelPayload, formatDuration, saudiDateTime, topEmbed } = require('./text');

const required = ['DISCORD_TOKEN', 'CLIENT_ID', 'GUILD_ID', 'PANEL_CHANNEL_ID', 'LOG_CHANNEL_ID'];
for (const key of required) {
  if (!process.env[key] || process.env[key].startsWith('PUT_')) {
    console.error(`Missing ${key}. Copy .env.example to .env and fill it in.`);
    process.exit(1);
  }
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const leaderboardTimers = new Set();

async function getTextChannel(id) {
  const channel = await client.channels.fetch(id).catch(() => null);
  if (!channel || !channel.isTextBased() || !channel.send) {
    throw new Error(`Channel ${id} was not found or is not a text channel.`);
  }
  return channel;
}

async function ensurePanel() {
  const channel = await getTextChannel(process.env.PANEL_CHANNEL_ID);
  const saved = store.getPanel();

  if (saved.channelId === channel.id && saved.messageId) {
    const existing = await channel.messages.fetch(saved.messageId).catch(() => null);
    if (existing) {
      await existing.edit(panelPayload());
      console.log('Attendance panel updated.');
      return;
    }
  }

  const message = await channel.send(panelPayload());
  await store.setPanel(channel.id, message.id);
  console.log(`Attendance panel posted in #${channel.name}.`);
}

async function sendLog(embed) {
  const channel = await getTextChannel(process.env.LOG_CHANNEL_ID);
  await channel.send({ embeds: [embed], allowedMentions: { parse: ['users'] } });
}

function makeLogEmbed({ title, color, user, fields }) {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(`**${user}**`)
    .addFields(fields)
    .setTimestamp(new Date());
}

async function handleCheckIn(interaction, lang) {
  const words = t(lang);
  const result = await store.checkIn(interaction.user.id, interaction.user.username);
  if (!result.ok) {
    await interaction.reply({ content: words.already, ephemeral: true });
    return;
  }

  const when = saudiDateTime(result.startedAt, lang);
  const embed = makeLogEmbed({
    title: words.logInTitle,
    color: 0x2ecc71,
    user: `<@${interaction.user.id}>`,
    fields: [
      { name: words.date, value: when, inline: true },
      { name: words.status, value: words.started, inline: false }
    ]
  });
  await sendLog(embed);
  await interaction.reply({
    content: `${words.inOk}\n🕒 ${words.time}: **${when}**`,
    ephemeral: true
  });
}

async function handleCheckOut(interaction, lang) {
  const words = t(lang);
  const result = await store.checkOut(interaction.user.id, interaction.user.username);
  if (!result.ok) {
    await interaction.reply({ content: words.missing, ephemeral: true });
    return;
  }

  const start = saudiDateTime(result.startedAt, lang);
  const end = saudiDateTime(result.endedAt, lang);
  const duration = formatDuration(result.durationMs, lang);

  const embed = makeLogEmbed({
    title: words.logOutTitle,
    color: 0xe74c3c,
    user: `<@${interaction.user.id}>`,
    fields: [
      { name: words.start, value: start, inline: false },
      { name: words.end, value: end, inline: false },
      { name: words.duration, value: `**${duration}**`, inline: false },
      { name: words.status, value: words.finished, inline: false }
    ]
  });
  await sendLog(embed);
  await interaction.reply({
    content: `${words.outOk}\n⏱️ ${words.duration}: **${duration}**`,
    ephemeral: true
  });
}

async function showLanguagePicker(interaction, lang) {
  const words = t(lang);
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('attendance:lang:ar').setLabel('🇸🇦 العربية').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('attendance:lang:en').setLabel('🇺🇸 English').setStyle(ButtonStyle.Secondary)
  );
  await interaction.reply({ content: words.chooseLang, components: [row], ephemeral: true });
}

async function showTop10(interaction, lang) {
  const words = t(lang);
  const rows = store.getTop10();
  await interaction.reply({
    embeds: [topEmbed(rows, lang, Date.now())],
    ephemeral: true
  });

  // Refresh the private leaderboard every five seconds for two minutes.
  const timer = setInterval(async () => {
    try {
      const latest = store.getTop10();
      await interaction.editReply({ embeds: [topEmbed(latest, lang, Date.now())] });
    } catch {
      clearInterval(timer);
      leaderboardTimers.delete(timer);
    }
  }, 5000);

  leaderboardTimers.add(timer);
  setTimeout(() => {
    clearInterval(timer);
    leaderboardTimers.delete(timer);
  }, 120000);
}

client.once(Events.ClientReady, async readyClient => {
  console.log(`Logged in as ${readyClient.user.tag}`);
  try {
    await ensurePanel();
  } catch (err) {
    console.error('Could not create/update the panel:', err);
  }
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isButton()) return;
  if (!interaction.customId.startsWith('attendance:')) return;

  try {
    const userId = interaction.user.id;

    if (interaction.customId === 'attendance:language') {
      const lang = store.getLanguage(userId);
      await showLanguagePicker(interaction, lang);
      return;
    }

    if (interaction.customId === 'attendance:lang:ar' || interaction.customId === 'attendance:lang:en') {
      const lang = interaction.customId.endsWith(':en') ? 'en' : 'ar';
      await store.setLanguage(userId, lang);
      await interaction.update({
        content: t(lang).langSaved,
        components: []
      });
      return;
    }

    const lang = store.getLanguage(userId);
    if (interaction.customId === 'attendance:in') {
      await handleCheckIn(interaction, lang);
    } else if (interaction.customId === 'attendance:out') {
      await handleCheckOut(interaction, lang);
    } else if (interaction.customId === 'attendance:top') {
      await showTop10(interaction, lang);
    }
  } catch (err) {
    console.error('Interaction error:', err);
    const message = 'صار خطأ أثناء تنفيذ الطلب. تأكد من صلاحيات البوت وروم السجلات.';
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({ content: message, ephemeral: true }).catch(() => {});
    } else {
      await interaction.reply({ content: message, ephemeral: true }).catch(() => {});
    }
  }
});

async function start() {
  await store.initStore();
  await client.login(process.env.DISCORD_TOKEN);
}

process.on('SIGINT', () => {
  for (const timer of leaderboardTimers) clearInterval(timer);
  client.destroy();
  process.exit(0);
});

start().catch(err => {
  console.error('Bot startup failed:', err);
  process.exit(1);
});
