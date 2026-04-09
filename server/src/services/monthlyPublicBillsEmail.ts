import { MonthlyEmailLog } from '../models/MonthlyEmailLog.js';

type PublicBillsData = {
  members?: Array<{
    name?: string;
    totalExpenseShare?: number;
    pastPending?: number;
    currentMonthExpenses?: number;
    amountPaid?: number;
    outstandingBalance?: number;
    advanceTotalPaid?: number;
    breakdown?: Array<{
      date?: string;
      description?: string;
      category?: string;
      isInventory?: boolean;
      itemName?: string;
      shareAmount?: number;
      paidStatus?: boolean;
    }>;
  }>;
  equipment?: Array<{
    date?: string;
    quantityPurchased?: number;
    quantityUsed?: number;
    boughtByName?: string;
    paidBy?: string | { name?: string };
  }>;
  courtAdvanceBookings?: Array<{
    date?: string;
    courtBookedDate?: string;
    bookedByName?: string;
    courtsBooked?: number;
  }>;
  sessionHistory?: Array<{
    date?: string;
    description?: string;
    courtBookingCost?: number;
    shuttlesUsed?: number;
    perShuttleCost?: number;
    amount?: number;
    selectedMembers?: Array<string | { name?: string }>;
  }>;
};

type MailConfig = {
  provider: 'smtp' | 'resend';
  host?: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  from?: string;
  service?: string;
  resendApiKey?: string;
};

type SendMonthlyReportOptions = {
  baseUrl: string;
  recipient?: string;
  period?: 'last_month' | 'this_month';
  reportKey?: string;
  force?: boolean;
};

const csvCell = (value: string | number | boolean | null | undefined) => {
  const text = String(value ?? '');
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

const formatDate = (value?: string | Date) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toISOString().slice(0, 10);
};

const buildPublicBillsCsv = (data: PublicBillsData) => {
  const members = data.members || [];
  const equipment = data.equipment || [];
  const courtAdvance = data.courtAdvanceBookings || [];
  const sessionHistory = data.sessionHistory || [];

  const sections: Array<{
    title: string;
    headers: string[];
    rows: Array<Array<string | number | boolean | null | undefined>>;
  }> = [
    {
      title: 'Member Billing Status',
      headers: [
        'Member',
        'Total Expense Share',
        'Past Pending',
        'Current Month Expenses',
        'Amount Paid',
        'Outstanding Balance',
        'Advance Status',
      ],
      rows: members.map((member) => [
        member.name || 'Unknown',
        Number(member.totalExpenseShare || 0).toFixed(2),
        Number(member.pastPending || 0).toFixed(2),
        Number(member.currentMonthExpenses || 0).toFixed(2),
        Number(member.amountPaid || 0).toFixed(2),
        Number(member.outstandingBalance || 0).toFixed(2),
        Number(member.advanceTotalPaid || 0) > 0 ? 'Paid' : 'Unpaid',
      ]),
    },
    {
      title: 'Member Expense Breakdown',
      headers: ['Member', 'Date', 'Description', 'Category', 'Share', 'Status'],
      rows: members.flatMap((member) =>
        (member.breakdown || []).map((item) => [
          member.name || 'Unknown',
          formatDate(item.date),
          item.isInventory ? item.itemName || item.description || '-' : item.description || '-',
          item.isInventory ? 'equipment-stock' : item.category || '-',
          Number(item.shareAmount || 0).toFixed(2),
          item.paidStatus ? 'Paid' : 'Unpaid',
        ])
      ),
    },
    {
      title: 'Equipment Stock',
      headers: ['Date', 'Item', 'Qty', 'Used', 'Remaining', 'Bought By', 'Paid By'],
      rows: equipment.map((item) => {
        const qty = Number(item.quantityPurchased || 0);
        const used = Number(item.quantityUsed || 0);
        return [
          formatDate(item.date),
          'Shuttle',
          qty,
          used,
          Math.max(0, qty - used),
          item.boughtByName || '-',
          typeof item.paidBy === 'object' ? item.paidBy?.name || 'Unknown' : item.paidBy || '-',
        ];
      }),
    },
    {
      title: 'Court Advance Bookings',
      headers: ['Date', 'Booked By', 'No. of Courts'],
      rows: courtAdvance.map((item) => [
        formatDate(item.courtBookedDate || item.date),
        item.bookedByName || '-',
        Number(item.courtsBooked || 0),
      ]),
    },
    {
      title: 'Session History',
      headers: [
        'Date',
        'Description',
        'Court Cost',
        'Shuttles Used',
        'Per Shuttle Cost',
        'Total Shuttle Cost',
        'Total Amount',
        'Players Played',
      ],
      rows: sessionHistory.map((item) => [
        formatDate(item.date),
        item.description || '-',
        Number(item.courtBookingCost || 0).toFixed(2),
        Number(item.shuttlesUsed || 0),
        Number(item.perShuttleCost || 0).toFixed(2),
        (Number(item.shuttlesUsed || 0) * Number(item.perShuttleCost || 0)).toFixed(2),
        Number(item.amount || 0).toFixed(2),
        (item.selectedMembers || [])
          .map((member) => (typeof member === 'object' ? member?.name : member))
          .filter(Boolean)
          .join(', ') || '-',
      ]),
    },
  ];

  const lines: string[] = [];
  sections.forEach((section, index) => {
    if (index > 0) {
      lines.push('');
      lines.push('');
    }
    lines.push(csvCell(section.title));
    lines.push(section.headers.map(csvCell).join(','));
    if (section.rows.length === 0) {
      lines.push(csvCell('No data'));
      return;
    }
    section.rows.forEach((row) => {
      lines.push(row.map(csvCell).join(','));
    });
  });

  lines.push('');
  lines.push('UBISmashers');
  return `\ufeff${lines.join('\n')}`;
};

const getDatePartsInTimeZone = (timeZone: string) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const valueOf = (type: string) => parts.find((part) => part.type === type)?.value || '';
  return {
    year: Number(valueOf('year')),
    month: Number(valueOf('month')),
    day: Number(valueOf('day')),
  };
};

const getMailConfig = (): MailConfig => {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (resendApiKey) {
    return {
      provider: 'resend',
      port: 443,
      secure: true,
      from: process.env.MONTHLY_REPORT_FROM || process.env.RESEND_FROM,
      resendApiKey,
    };
  }

  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER || process.env.MAIL_USER || process.env.GMAIL_USER;
  const smtpPass = process.env.SMTP_PASS || process.env.MAIL_PASS || process.env.GMAIL_APP_PASSWORD;
  const service = (process.env.SMTP_SERVICE || process.env.MAIL_SERVICE || (!smtpHost && smtpUser && smtpPass ? 'gmail' : undefined))
    ?.toLowerCase();
  const explicitPort = process.env.SMTP_PORT;
  const explicitSecure = process.env.SMTP_SECURE || process.env.MAIL_SECURE;
  const isGmailService = service === 'gmail';
  const port = Number(explicitPort || (isGmailService ? 465 : 587));
  const secure = explicitSecure
    ? String(explicitSecure) === 'true'
    : isGmailService
      ? true
      : port === 465;

  return {
    provider: 'smtp',
    host: smtpHost || (isGmailService ? 'smtp.gmail.com' : undefined),
    port,
    secure,
    user: smtpUser,
    pass: smtpPass,
    from: process.env.MONTHLY_REPORT_FROM || process.env.MAIL_FROM || smtpUser,
    service,
    resendApiKey,
  };
};

const assertMailConfig = (config: MailConfig) => {
  if (config.provider === 'resend') {
    if (!config.resendApiKey) {
      throw new Error('Missing RESEND_API_KEY for Resend delivery.');
    }
    if (!config.from) {
      throw new Error('Missing MONTHLY_REPORT_FROM or RESEND_FROM for Resend delivery.');
    }
    return;
  }

  if (!config.user || !config.pass) {
    throw new Error(
      'Missing mail credentials. Configure SMTP_USER/SMTP_PASS or MAIL_USER/MAIL_PASS or GMAIL_USER/GMAIL_APP_PASSWORD.'
    );
  }

  if (!config.host && !config.service) {
    throw new Error('Missing SMTP host/service. Configure SMTP_HOST or SMTP_SERVICE/MAIL_SERVICE.');
  }
};

const createTransport = async () => {
  const config = getMailConfig();
  assertMailConfig(config);

  if (config.provider !== 'smtp') {
    return {
      config,
      transporter: null,
      from: config.from!,
    };
  }

  const mailModule = await import('nodemailer');
  const nodemailer = mailModule.default;
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    service: config.service,
    auth: {
      user: config.user,
      pass: config.pass,
    },
    connectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT || 15000),
    greetingTimeout: Number(process.env.SMTP_GREETING_TIMEOUT || 15000),
    socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT || 20000),
  });

  await transporter.verify();

  return {
    config,
    transporter,
    from: config.from || config.user!,
  };
};

const buildTimeoutHint = (config: MailConfig) => {
  if (config.provider === 'resend') {
    return 'Mail API request timed out. Recheck RESEND_API_KEY, Render outbound HTTPS access, and MONTHLY_REPORT_FROM.';
  }

  if ((config.service || '').toLowerCase() === 'gmail' || config.host === 'smtp.gmail.com') {
    return `SMTP connection timed out while reaching Gmail (${config.host}:${config.port}). On Render, prefer port 465 with secure=true, or switch to RESEND_API_KEY to avoid SMTP timeouts entirely.`;
  }

  return `SMTP connection timed out while reaching ${config.host || config.service || 'the configured provider'} (${config.port}). Check the host, port, secure flag, and whether your provider allows outbound connections from Render.`;
};

const normalizeMailError = (error: unknown, config: MailConfig) => {
  if (error instanceof Error && 'code' in error && (error as { code?: string }).code === 'ETIMEDOUT') {
    return new Error(buildTimeoutHint(config));
  }
  return error instanceof Error ? error : new Error('Unknown mail delivery error');
};

const sendViaResend = async ({
  apiKey,
  from,
  to,
  subject,
  text,
  filename,
  csv,
}: {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  text: string;
  filename: string;
  csv: string;
}) => {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      text,
      attachments: [
        {
          filename,
          content: Buffer.from(csv, 'utf8').toString('base64'),
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Resend request failed with status ${response.status}${body ? `: ${body}` : ''}`);
  }
};

const fetchPublicBillsData = async (baseUrl: string, period: 'last_month' | 'this_month') => {
  const response = await fetch(`${baseUrl}/api/public/bills?period=${period}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch public bills data. Status ${response.status}`);
  }

  return (await response.json()) as PublicBillsData;
};

export const sendMonthlyPublicBillsReport = async ({
  baseUrl,
  recipient,
  period = 'last_month',
  reportKey,
  force = false,
}: SendMonthlyReportOptions) => {
  const { year, month } = getDatePartsInTimeZone(process.env.MONTHLY_REPORT_TIMEZONE || 'Asia/Kolkata');
  const monthKey = `${year}-${String(month).padStart(2, '0')}`;
  const resolvedRecipient = recipient || process.env.MONTHLY_REPORT_TO || 'ubismashers@gmail.com';
  const resolvedReportKey = reportKey || `public-bills-${period}-${monthKey}`;

  if (!force) {
    const existingLog = await MonthlyEmailLog.findOne({ reportKey: resolvedReportKey }).select('_id').lean();
    if (existingLog) {
      return { skipped: true, reason: 'already_sent', reportKey: resolvedReportKey, recipient: resolvedRecipient };
    }
  }

  const data = await fetchPublicBillsData(baseUrl, period);
  const csv = buildPublicBillsCsv(data);
  const filename = `UBISmashers_Public_Bills_${period}_${monthKey}.csv`;
  const { transporter, from, config } = await createTransport();
  const subject = `UBISmashers Public Bills Report - ${period === 'last_month' ? 'Last Month' : 'This Month'} (${monthKey})`;
  const text = `Attached is the UBISmashers public bills export for ${period.replace('_', ' ')}.`;

  try {
    if (config.provider === 'resend') {
      await sendViaResend({
        apiKey: config.resendApiKey!,
        from,
        to: resolvedRecipient,
        subject,
        text,
        filename,
        csv,
      });
    } else {
      await transporter!.sendMail({
        from,
        to: resolvedRecipient,
        subject,
        text,
        attachments: [
          {
            filename,
            content: csv,
            contentType: 'text/csv; charset=utf-8',
          },
        ],
      });
    }
  } catch (error) {
    throw normalizeMailError(error, config);
  }

  await MonthlyEmailLog.findOneAndUpdate(
    { reportKey: resolvedReportKey },
    {
      reportKey: resolvedReportKey,
      recipient: resolvedRecipient,
      sentAt: new Date(),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  console.log(`[monthly-report] Sent ${filename} to ${resolvedRecipient}`);
  return { skipped: false, reportKey: resolvedReportKey, recipient: resolvedRecipient, filename };
};

export const getMonthlyPublicBillsMailStatus = async () => {
  const config = getMailConfig();
  assertMailConfig(config);

  if (config.provider === 'resend') {
    return {
      provider: 'resend' as const,
      from: config.from || null,
      verified: Boolean(config.resendApiKey && config.from),
      details: 'Using Resend HTTP API delivery.',
    };
  }

  const transport = await createTransport();
  return {
    provider: 'smtp' as const,
    host: config.host || null,
    port: config.port,
    secure: config.secure,
    service: config.service || null,
    from: transport.from,
    verified: true,
    details: 'SMTP transport verified successfully.',
  };
};

const checkAndSendMonthlyPublicBillsReport = async (baseUrl: string) => {
  const timeZone = process.env.MONTHLY_REPORT_TIMEZONE || 'Asia/Kolkata';
  const { year, month, day } = getDatePartsInTimeZone(timeZone);
  if (day !== 1) return;

  await sendMonthlyPublicBillsReport({
    baseUrl,
    period: 'last_month',
    reportKey: `public-bills-last-month-${year}-${String(month).padStart(2, '0')}`,
  });
};

export const startMonthlyPublicBillsEmailJob = (port: string | number) => {
  if (String(process.env.MONTHLY_REPORT_ENABLED || 'true') !== 'true') {
    console.log('[monthly-report] Disabled via MONTHLY_REPORT_ENABLED');
    return;
  }

  const baseUrl = process.env.MONTHLY_REPORT_BASE_URL || `http://127.0.0.1:${port}`;

  const run = async () => {
    try {
      await checkAndSendMonthlyPublicBillsReport(baseUrl);
    } catch (error) {
      console.error('[monthly-report] Job failed:', error);
    }
  };

  setTimeout(run, 15_000);
  setInterval(run, 60 * 60 * 1000);
  console.log('[monthly-report] Scheduler started (checks hourly)');
};
