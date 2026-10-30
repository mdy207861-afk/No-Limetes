const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const TEXT = {
  ar: {
    title: 'NO LIMITES | نظام الحضور والانصراف',
    description: 'أهلاً بك في نظام الحضور والانصراف.\nاختر الزر المناسب لتسجيل وقت حضورك ومتابعة ترتيب الأعضاء.',
    in: 'تسجيل دخول',
    out: 'تسجيل خروج',
    top: 'TOP 10',
    chooseLang: 'اختر اللغة:',
    langSaved: 'تم تغيير لغتك إلى العربية.',
    inOk: 'تم تسجيل دخولك بنجاح.',
    outOk: 'تم تسجيل خروجك بنجاح.',
    already: 'أنت مسجل دخول بالفعل.',
    missing: 'أنت غير مسجل دخول حالياً.',
    topTitle: '🏆 أفضل 10 أعضاء',
    noMembers: 'لا توجد سجلات حضور حتى الآن.',
    total: 'إجمالي وقتك',
    active: '🟢 مسجل دخول',
    inactive: '⚫ غير مسجل دخول',
    logInTitle: '🟢 تسجيل دخول',
    logOutTitle: '🔴 تسجيل خروج',
    member: 'العضو',
    date: 'التاريخ',
    time: 'الوقت',
    start: 'وقت الدخول',
    end: 'وقت الخروج',
    duration: 'مدة الجلسة',
    status: 'الحالة',
    started: 'بدأ احتساب وقت الحضور.',
    finished: 'انتهت جلسة الحضور.',
    language: 'اللغة'
  },
  en: {
    title: 'NO LIMITES | Attendance System',
    description: 'Welcome to the attendance system.\nUse the buttons below to check in, check out, and view the member ranking.',
    in: 'Check in',
    out: 'Check out',
    top: 'TOP 10',
    chooseLang: 'Choose your language:',
    langSaved: 'Your language has been set to English.',
    inOk: 'You have checked in successfully.',
    outOk: 'You have checked out successfully.',
    already: 'You are already checked in.',
    missing: 'You are not checked in right now.',
    topTitle: '🏆 Top 10 Members',
    noMembers: 'There are no attendance records yet.',
    total: 'Your total time',
    active: '🟢 Checked in',
    inactive: '⚫ Not checked in',
    logInTitle: '🟢 Check-in',
    logOutTitle: '🔴 Check-out',
    member: 'Member',
    date: 'Date',
    time: 'Time',
    start: 'Check-in time',
    end: 'Check-out time',
    duration: 'Session duration',
    status: 'Status',
    started: 'Attendance timer started.',
    finished: 'Attendance session completed.',
    language: 'Language'
  }
};

function t(lang) {
  return TEXT[lang] || TEXT.ar;
}

function panelPayload() {
  const e = new EmbedBuilder()
    .setColor(0x202020)
    .setTitle('NO LIMITES | ATTENDANCE SYSTEM')
    .setDescription(
      '🇸🇦 **نظام الحضور والانصراف**\nسجّل دخولك عند بدء حضورك، وسجّل خروجك عند الانتهاء.\n\n' +
      '🇺🇸 **Attendance System**\nCheck in when you arrive and check out when you finish.'
    )
    .setFooter({ text: 'NO LIMITES • Attendance' });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('attendance:in').setLabel('🟢 تسجيل دخول / Check in').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('attendance:out').setLabel('🔴 تسجيل خروج / Check out').setStyle(ButtonStyle.Danger)
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('attendance:top').setLabel('🏆 TOP 10').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('attendance:language').setEmoji('🌐').setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [e], components: [row, row2] };
}

function formatDuration(ms, lang = 'ar') {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (lang === 'en') {
    const parts = [];
    if (days) parts.push(`${days}d`);
    if (hours) parts.push(`${hours}h`);
    if (minutes) parts.push(`${minutes}m`);
    parts.push(`${seconds}s`);
    return parts.join(' ');
  }

  const parts = [];
  if (days) parts.push(`${days} يوم`);
  if (hours) parts.push(`${hours} ساعة`);
  if (minutes) parts.push(`${minutes} دقيقة`);
  parts.push(`${seconds} ثانية`);
  return parts.join(' و ');
}

function saudiDateTime(ms, lang = 'ar') {
  return new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'ar-SA', {
    timeZone: 'Asia/Riyadh',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: true
  }).format(new Date(ms));
}

function topEmbed(rows, lang, now) {
  const words = t(lang);
  const e = new EmbedBuilder().setColor(0x202020).setTitle(words.topTitle);
  if (!rows.length) {
    e.setDescription(words.noMembers);
    return e;
  }
  const medals = ['🥇', '🥈', '🥉'];
  const lines = rows.map((row, i) => {
    const medal = medals[i] || `**${i + 1}.**`;
    const status = row.active ? '🟢' : '⚫';
    return `${medal} <@${row.userId}> — **${formatDuration(row.totalMs, lang)}** ${status}`;
  });
  e.setDescription(lines.join('\n'));
  e.setFooter({ text: `${words.total} • Updated ${new Date(now).toLocaleTimeString(lang === 'en' ? 'en-GB' : 'ar-SA', { timeZone: 'Asia/Riyadh' })}` });
  return e;
}

module.exports = { t, panelPayload, formatDuration, saudiDateTime, topEmbed };
