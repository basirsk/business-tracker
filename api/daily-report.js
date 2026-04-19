/**
 * Vercel Serverless Function — /api/daily-report
 * ─────────────────────────────────────────────────
 * Uses Firestore REST API (no Admin SDK / no gRPC) to avoid
 * Vercel hobby-plan network restrictions.
 *
 * Required env vars:
 *   RESEND_API_KEY           — from resend.com
 *   FIREBASE_SERVICE_ACCOUNT — Firebase service-account JSON, base64-encoded
 *   CRON_SECRET              — random secret string
 */

import { createSign } from 'crypto';
import { Resend } from 'resend';

const b64url = (str) =>
    Buffer.from(str).toString('base64')
        .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

/* ── Google OAuth2 token from service account ── */
async function getAccessToken(sa) {
    const now = Math.floor(Date.now() / 1000);
    const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const payload = b64url(JSON.stringify({
        iss: sa.client_email,
        scope: 'https://www.googleapis.com/auth/datastore',
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600,
    }));

    // Sign with Node.js crypto (RS256)
    const pemKey = sa.private_key.replace(/\\n/g, '\n');
    const sigInput = `${header}.${payload}`;
    const signer = createSign('RSA-SHA256');
    signer.update(sigInput);
    const sig = signer.sign(pemKey, 'base64')
        .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const jwt = `${sigInput}.${sig}`;

    // Exchange JWT for access token
    const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
    });
    const data = await res.json();
    if (!data.access_token) throw new Error('Token error: ' + JSON.stringify(data));
    return data.access_token;
}

/* ── Section metadata ── */
const SECTIONS = [
    { key: 'sales', label: 'Sales', emoji: '🛍️', color: '#16a34a' },
    { key: 'expenses', label: 'Expenses', emoji: '💸', color: '#dc2626' },
    { key: 'income', label: 'Income', emoji: '💰', color: '#2563eb' },
    { key: 'stock', label: 'Stock', emoji: '📦', color: '#9333ea' },
];

const inr = (n) =>
    `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;

function todayIST() {
    const now = new Date();
    const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
    return ist.toISOString().slice(0, 10);
}

function fmtDate(d) {
    if (!d) return '—';
    try {
        return new Date(d).toLocaleDateString('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric',
        });
    } catch { return d; }
}

/* ── Firestore REST query ── */
async function fetchData(projectId, token) {
    const today = todayIST();
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`;

    const body = {
        structuredQuery: {
            from: [{ collectionId: 'bt_transactions' }],
        },
    };

    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Firestore query failed: ${err}`);
    }

    const rows = await res.json();

    const allTime = {};
    const todayTxs = {};
    for (const sec of SECTIONS) {
        allTime[sec.key] = 0;
        todayTxs[sec.key] = [];
    }

    for (const row of rows) {
        if (!row.document) continue;
        const fields = row.document.fields || {};
        const tx = parseFirestoreDoc(fields);
        const sec = tx.section;
        if (!allTime.hasOwnProperty(sec)) continue;
        allTime[sec] += Number(tx.amount || 0);
        if (tx.date === today) todayTxs[sec].push(tx);
    }

    return { today, allTime, todayTxs };
}

function parseFirestoreDoc(fields) {
    const out = {};
    for (const [k, v] of Object.entries(fields)) {
        if (v.stringValue !== undefined) out[k] = v.stringValue;
        else if (v.integerValue !== undefined) out[k] = Number(v.integerValue);
        else if (v.doubleValue !== undefined) out[k] = Number(v.doubleValue);
        else if (v.booleanValue !== undefined) out[k] = v.booleanValue;
        else if (v.timestampValue !== undefined) out[k] = v.timestampValue;
        else out[k] = null;
    }
    return out;
}

/* ── Build HTML email ── */
function buildHtml(today, allTime, todayTxs) {
    const totalTodaySales = todayTxs.sales.reduce((s, t) => s + Number(t.amount || 0), 0);
    const totalTodayExpenses = todayTxs.expenses.reduce((s, t) => s + Number(t.amount || 0), 0);
    const netToday = totalTodaySales - totalTodayExpenses;

    const sectionHtml = SECTIONS.map(sec => {
        const txs = todayTxs[sec.key];
        const todayTotal = txs.reduce((s, t) => s + Number(t.amount || 0), 0);

        const rows = txs.length === 0
            ? `<tr><td colspan="5" style="text-align:center;color:#9ca3af;padding:16px;font-style:italic;">No transactions today</td></tr>`
            : txs.map(tx => `
                <tr>
                    <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;color:#374151;">${tx.date || '—'}</td>
                    <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;color:#374151;">${tx.description || '—'}</td>
                    ${sec.key === 'sales' ? `
                        <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;color:#374151;">${tx.customerName || '—'}</td>
                        <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;color:#374151;">${tx.phone || '—'}</td>
                    ` : `
                        <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;color:#6b7280;" colspan="2">—</td>
                    `}
                    <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-weight:600;color:${sec.color};text-align:right;">${inr(tx.amount)}</td>
                </tr>
            `).join('');

        return `
        <div style="margin-bottom:32px;">
            <div style="background:${sec.color};border-radius:12px 12px 0 0;padding:14px 20px;display:flex;justify-content:space-between;align-items:center;">
                <span style="color:#fff;font-size:16px;font-weight:700;">${sec.emoji} ${sec.label}</span>
                <span style="color:#fff;font-size:13px;opacity:0.85;">Today: ${inr(todayTotal)} &nbsp;|&nbsp; All-time: ${inr(allTime[sec.key])}</span>
            </div>
            <table style="width:100%;border-collapse:collapse;background:#fff;border-radius:0 0 12px 12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
                <thead>
                    <tr style="background:#f9fafb;">
                        <th style="padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:#6b7280;">Date</th>
                        <th style="padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:#6b7280;">Description</th>
                        <th style="padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:#6b7280;">${sec.key === 'sales' ? 'Customer' : '—'}</th>
                        <th style="padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:#6b7280;">${sec.key === 'sales' ? 'Phone' : '—'}</th>
                        <th style="padding:10px 12px;text-align:right;font-size:11px;text-transform:uppercase;color:#6b7280;">Amount</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
                ${txs.length > 0 ? `
                <tfoot>
                    <tr style="background:#f9fafb;">
                        <td colspan="4" style="padding:10px 12px;font-weight:700;color:#374151;">Today's Total</td>
                        <td style="padding:10px 12px;font-weight:700;color:${sec.color};text-align:right;">${inr(todayTotal)}</td>
                    </tr>
                </tfoot>` : ''}
            </table>
        </div>`;
    }).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><title>Daily Report — ${fmtDate(today)}</title></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f3f4f6;">
    <div style="max-width:700px;margin:0 auto;padding:24px;">
        <div style="background:linear-gradient(135deg,#1e3a5f 0%,#0f766e 100%);border-radius:16px;padding:28px 32px;margin-bottom:24px;text-align:center;">
            <div style="font-size:32px;margin-bottom:8px;">🧸</div>
            <h1 style="margin:0;color:#fff;font-size:22px;font-weight:800;">Gitanjali Toys</h1>
            <p style="margin:6px 0 0;color:#a5f3fc;font-size:15px;">Daily Business Report — ${fmtDate(today)}</p>
        </div>
        <div style="background:#fff;border-radius:12px;padding:20px 24px;margin-bottom:24px;box-shadow:0 1px 3px rgba(0,0,0,0.08);display:flex;gap:16px;flex-wrap:wrap;">
            <div style="flex:1;min-width:130px;text-align:center;padding:12px;background:#f0fdf4;border-radius:8px;">
                <p style="margin:0;font-size:11px;text-transform:uppercase;color:#6b7280;">Today's Net</p>
                <p style="margin:4px 0 0;font-size:22px;font-weight:800;color:${netToday >= 0 ? '#16a34a' : '#dc2626'};">${inr(Math.abs(netToday))}</p>
                <p style="margin:2px 0 0;font-size:11px;color:#6b7280;">${netToday >= 0 ? 'Profit' : 'Loss'}</p>
            </div>
            ${SECTIONS.map(s => `
            <div style="flex:1;min-width:130px;text-align:center;padding:12px;background:#f9fafb;border-radius:8px;">
                <p style="margin:0;font-size:11px;text-transform:uppercase;color:#6b7280;">${s.emoji} ${s.label} All-time</p>
                <p style="margin:4px 0 0;font-size:18px;font-weight:700;color:${s.color};">${inr(allTime[s.key])}</p>
            </div>`).join('')}
        </div>
        ${sectionHtml}
        <p style="text-align:center;color:#9ca3af;font-size:12px;margin-top:24px;">
            Auto-generated at 11:30 PM IST by Gitanjali Toys Business Tracker.
        </p>
    </div>
</body>
</html>`;
}

/* ── Main handler ── */
export default async function handler(req, res) {
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
        const authHeader = req.headers['authorization'];
        if (authHeader !== `Bearer ${cronSecret}`) {
            return res.status(401).json({ error: 'Unauthorised' });
        }
    }

    try {
        // Parse service account
        const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
        if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT env var missing');
        let sa;
        if (raw.trim().startsWith('{')) {
            sa = JSON.parse(raw);
        } else {
            sa = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
        }
        if (sa.private_key?.includes('\\n')) {
            sa.private_key = sa.private_key.replace(/\\n/g, '\n');
        }

        // Get OAuth2 token & fetch data
        const token = await getAccessToken(sa);
        const { today, allTime, todayTxs } = await fetchData(sa.project_id, token);

        const resend = new Resend(process.env.RESEND_API_KEY);
        const txCount = Object.values(todayTxs).reduce((s, txs) => s + txs.length, 0);
        const totalToday = Object.values(todayTxs).reduce(
            (sum, txs) => sum + txs.reduce((s, t) => s + Number(t.amount || 0), 0), 0
        );

        const { data, error } = await resend.emails.send({
            from: 'Gitanjali Toys <onboarding@resend.dev>',
            to: ['culebasir@gmail.com'],
            subject: `📊 Daily Report — ${fmtDate(today)} | ${txCount} txn${txCount !== 1 ? 's' : ''} | Total ${inr(totalToday)}`,
            html: buildHtml(today, allTime, todayTxs),
        });

        if (error) {
            console.error('Resend error:', error);
            return res.status(500).json({ error: error.message });
        }

        console.log('Daily report sent:', data?.id);
        return res.status(200).json({
            success: true,
            emailId: data?.id,
            date: today,
            transactionCount: txCount,
        });

    } catch (err) {
        console.error('daily-report error:', err);
        return res.status(500).json({ error: err.message });
    }
}
