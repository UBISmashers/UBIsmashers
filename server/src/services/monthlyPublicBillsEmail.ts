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

const checkAndSendMonthlyPublicBillsReport = async (baseUrl: string) => {
  const timeZone = process.env.MONTHLY_REPORT_TIMEZONE || 'Asia/Kolkata';
  const { year, month, day } = getDatePartsInTimeZone(timeZone);
  if (day !== 1) return;

  const monthKey = `${year}-${String(month).padStart(2, '0')}`;
  const reportKey = `public-bills-last-month-${monthKey}`;
  const recipient = process.env.MONTHLY_REPORT_TO || 'ubismashers@gmail.com';

  const existingLog = await MonthlyEmailLog.findOne({ reportKey }).select('_id').lean();
  if (existingLog) return;

  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = Number(process.env.SMTP_PORT || 587);
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (!smtpHost || !smtpUser || !smtpPass) {
    console.warn('[monthly-report] SMTP config missing. Skipping monthly email.');
    return;
  }

  let nodemailer: any;
  try {
    const mailModule = await import('nodemailer');
    nodemailer = mailModule.default;
  } catch (error) {
    console.warn('[monthly-report] nodemailer is not installed. Skipping monthly email.');
    return;
  }

  const response = await fetch(`${baseUrl}/api/public/bills?period=last_month`);
  if (!response.ok) {
    throw new Error(`Failed to fetch public bills data. Status ${response.status}`);
  }

  const data = (await response.json()) as PublicBillsData;
  const csv = buildPublicBillsCsv(data);
  const filename = `UBISmashers_Public_Bills_${monthKey}.csv`;

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: String(process.env.SMTP_SECURE || 'false') === 'true',
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  await transporter.sendMail({
    from: process.env.MONTHLY_REPORT_FROM || smtpUser,
    to: recipient,
    subject: `UBISmashers Public Bills Report - ${monthKey}`,
    text: `Attached is the monthly public bills export for ${monthKey}.`,
    attachments: [
      {
        filename,
        content: csv,
        contentType: 'text/csv; charset=utf-8',
      },
    ],
  });

  await MonthlyEmailLog.create({
    reportKey,
    recipient,
    sentAt: new Date(),
  });

  console.log(`[monthly-report] Sent ${filename} to ${recipient}`);
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
