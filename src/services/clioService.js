// clioService.js
import axios from 'axios';
import { Types } from 'mongoose';
import ClioToken from '../models/clioToken.js';
import { getAccessToken } from './clioTokenService.js';

function isoDateToday() {
  return new Date().toISOString().split('T')[0];
}
const asIdString = (v) => (v == null ? v : String(v));

// ---- Activities (time entry)
export async function pushTimeEntryToClio({ userId, matterId, quantity, description, date }) {
  const token = await getAccessToken(userId);

  const tokenDoc = await ClioToken.findOne({ userId: new Types.ObjectId(userId) });
  const resolvedMatterId = matterId || tokenDoc?.defaultMatterId || process.env.CLIO_MATTER_ID;
  if (!resolvedMatterId) throw new Error('Missing Clio Matter ID');

  const qty = Math.max(Number(quantity ?? 0), 0.1);

  // IMPORTANT: send a plain object (not a pre-stringified string)
  const body = {
    data: {
      type: 'TimeEntry',
      attributes: {                      
        date: date || new Date().toISOString().split('T')[0],
        quantity: qty,                     
        description: String(description ?? ''),
        billable: true
      },
      relationships: {
        matter: { data: { type: 'matters', id: asIdString(resolvedMatterId) } }
      }
    }
  };

  console.log('[Clio] POST /activities body (axios object):', JSON.stringify(body));

  const resp = await axios.post(
    'https://app.clio.com/api/v4/activities',
    body, // <-- plain object
    {
      headers: {
        Authorization: `Bearer ${token}`,
        // Use application/json so Rails JSON parser runs reliably
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      validateStatus: () => true
    }
  );

  if (resp.status >= 400) {
    console.error('[Clio] /activities failed:', resp.status, JSON.stringify(resp.data));
    throw new Error(`Clio activities error ${resp.status}: ${JSON.stringify(resp.data)}`);
  }
  return resp.data;
}

// ---- Get a single time entry (activity) by ID
export async function getClioActivityById({ userId, activityId }) {
  const token = await getAccessToken(userId);

  const resp = await axios.get(
    `https://app.clio.com/api/v4/activities/${activityId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json'
      },
      validateStatus: () => true
    }
  );

  console.log('[Clio] GET /activities/:id', resp.status, JSON.stringify(resp.data));

  if (resp.status >= 400) {
    throw new Error(`Fetch activity error ${resp.status}: ${JSON.stringify(resp.data)}`);
  }

  return resp.data;
}



// ---- Bills (invoice)
export async function pushInvoiceToClio({ userId, matterId, lineItems, issueDate, state = 'unpaid' }) {
  const token = await getAccessToken(userId);

  if (!matterId) throw new Error('Missing Clio Matter ID for invoice');
  if (!Array.isArray(lineItems) || lineItems.length === 0) {
    throw new Error('Invoice must include at least one line item');
  }

  // IMPORTANT: plain object, not a string
  const body = {
    data: {
      type: 'bills',
      attributes: {
        issue_date: issueDate || isoDateToday(),
        state
      },
      relationships: {
        matter: { data: { type: 'matters', id: asIdString(matterId) } },
        bill_line_items: {
          data: lineItems.map((item) => ({
            type: 'bill_line_items',
            attributes: {
              description: String(item.description ?? ''),
              quantity: Math.max(Number(item.quantity ?? 0), 0.1),
              rate: Number(item.rate ?? 0)
            }
          }))
        }
      }
    }
  };

  console.log('[Clio] POST /bills body (axios object):', JSON.stringify(body));

  const resp = await axios.post(
    'https://app.clio.com/api/v4/bills',
    body, // <-- plain object
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      validateStatus: () => true
    }
  );

  if (resp.status >= 400) {
    console.error('[Clio] /bills failed:', resp.status, JSON.stringify(resp.data));
    throw new Error(`Clio bills error ${resp.status}: ${JSON.stringify(resp.data)}`);
  }
  return resp.data;
}
