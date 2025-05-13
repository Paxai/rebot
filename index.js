const express = require('express');
const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Events
} = require('discord.js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMessageReactions
  ],
  partials: [Partials.Channel, Partials.Message, Partials.Reaction]
});

// CONFIG
const GUILD_ID = '1359567770827751584';
const CHANNEL_ID = '1361817608646562153';
const WHITELISTED_ROLE_ID = '1361817240512758000';
const REJECTED_ROLE_ID = '1361817341935222845';
const API_KEY = process.env.API_KEY;

// 🔐 API KEY middleware
const checkApiKey = (req, res, next) => {
  const apiKey = req.headers['api_key'];
  if (apiKey !== API_KEY) {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  next();
};

// ✅ CHECK ENDPOINT (czy ma rolę whitelist)
app.post('/check', checkApiKey, async (req, res) => {
  const userId = req.body.userId;
  if (!userId) {
    return res.status(400).json({ error: 'Brak userId w żądaniu' });
  }

  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    const member = await guild.members.fetch(userId);

    const hasRole = member.roles.cache.has(WHITELISTED_ROLE_ID);
    return res.json({ status: hasRole ? 'whitelisted' : 'non-whitelisted' });

  } catch (error) {
    console.error('❌ Błąd przy sprawdzaniu roli:', error);
    return res.status(500).json({ error: 'Nie udało się sprawdzić użytkownika' });
  }
});

// 📝 WHITELIST SUBMISSION ENDPOINT
app.post('/whitelist', checkApiKey, async (req, res) => {
  const { userId, username, formData } = req.body;

  if (!userId || !username || !formData) {
    return res.status(400).json({ error: 'Brak wymaganych pól' });
  }

  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    const member = await guild.members.fetch(userId);
    const channel = await guild.channels.fetch(CHANNEL_ID);

    const embed = new EmbedBuilder()
      .setTitle('📬 Nowa aplikacja whitelist')
      .setDescription(`Zgłoszenie od: <@${userId}> (${username})`)
      .setColor(0x00AE86)
      .setTimestamp();

    for (const [key, value] of Object.entries(formData)) {
      embed.addFields({ name: key, value: String(value), inline: false });
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`accept_${userId}`)
        .setLabel('✅ Akceptuj')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`reject_${userId}`)
        .setLabel('❌ Odrzuć')
        .setStyle(ButtonStyle.Danger)
    );

    await channel.send({ embeds: [embed], components: [row] });

    return res.json({ success: true, message: 'Embed wysłany' });

  } catch (error) {
    console.error('❌ Błąd przy przetwarzaniu whitelist:', error);
    return res.status(500).json({ error: 'Błąd serwera' });
  }
});

// 🎛️ REAKCJE NA PRZYCISKI (Akceptuj / Odrzuć)
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isButton()) return;

  const [action, userId] = interaction.customId.split('_');
  const guild = await client.guilds.fetch(GUILD_ID);
  const member = await guild.members.fetch(userId);

  try {
    if (action === 'accept') {
      await member.roles.add(WHITELISTED_ROLE_ID);
      await interaction.reply({ content: `✅ Zaakceptowano <@${userId}>.`, ephemeral: true });

      try {
        await member.send('🎉 Twoja aplikacja whitelist została zaakceptowana! Witamy na serwerze!');
      } catch (err) {
        console.warn('Nie udało się wysłać DM:', err.message);
      }

    } else if (action === 'reject') {
      await member.roles.add(REJECTED_ROLE_ID);
      await interaction.reply({ content: `❌ Odrzucono <@${userId}>.`, ephemeral: true });

      try {
        await member.send('😞 Twoja aplikacja whitelist została odrzucona. Spróbuj ponownie później.');
      } catch (err) {
        console.warn('Nie udało się wysłać DM:', err.message);
      }
    }
  } catch (err) {
    console.error('❌ Błąd przy obsłudze przycisku:', err);
    await interaction.reply({ content: '❌ Wystąpił błąd podczas przetwarzania akcji.', ephemeral: true });
  }
});

// 🌐 Start serwera
app.listen(PORT, () => {
  console.log(`🌐 HTTP API działa na porcie ${PORT}`);
});

// 🔑 Logowanie bota
client.once('ready', () => {
  console.log(`✅ Zalogowano jako ${client.user.tag}`);
});

client.login(process.env.DISCORD_TOKEN).catch(err => {
  console.error('❌ Błąd logowania bota:', err);
});
