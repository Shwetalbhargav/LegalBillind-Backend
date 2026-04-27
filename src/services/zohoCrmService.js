import axios from 'axios';
import { Case } from '../models/Case.js';
import { Client } from '../models/Client.js';
import { Invoice } from '../models/Invoice.js';
import { getValidZohoConnection } from './zohoAuthService.js';

function buildCriteria(field, value) {
  return `(${field}:equals:${String(value).replace(/([,()\\])/g, '\\$1')})`;
}

export async function zohoRequest(userId, method, path, { params, data, headers, responseType } = {}) {
  const connection = await getValidZohoConnection(userId);
  const response = await axios({
    method,
    url: `${connection.apiDomain}${path}`,
    headers: {
      Authorization: `Zoho-oauthtoken ${connection.accessToken}`,
      ...(headers || {}),
    },
    params,
    data,
    responseType,
  });
  return response.data;
}

async function searchOne(userId, moduleApiName, field, value) {
  const criteria = buildCriteria(field, value);
  try {
    const data = await zohoRequest(
      userId,
      'get',
      `/crm/v8/${moduleApiName}/search`,
      { params: { criteria } }
    );
    return data?.data?.[0] || null;
  } catch (error) {
    if (error?.response?.status === 204 || error?.response?.data?.code === 'NO_CONTENT') {
      return null;
    }
    throw error;
  }
}

async function insertOne(userId, moduleApiName, record) {
  const data = await zohoRequest(userId, 'post', `/crm/v8/${moduleApiName}`, {
    data: { data: [record] },
  });
  const created = data?.data?.[0];
  if (!created?.details?.id) {
    throw new Error(`Zoho did not return a record id for module ${moduleApiName}`);
  }
  return created.details.id;
}

async function updateOne(userId, moduleApiName, recordId, record) {
  await zohoRequest(userId, 'put', `/crm/v8/${moduleApiName}/${recordId}`, {
    data: { data: [record] },
  });
  return recordId;
}

function splitName(fullName = '') {
  const trimmed = String(fullName || '').trim();
  if (!trimmed) return { firstName: '', lastName: 'Unknown' };
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { firstName: '', lastName: parts[0] };
  return {
    firstName: parts.slice(0, -1).join(' '),
    lastName: parts[parts.length - 1],
  };
}

function invoiceSubject(invoice, client, matter) {
  const clientName = client?.displayName || client?.name || 'Client';
  const matterName = matter?.title || matter?.name || 'Matter';
  const issueDate = invoice?.issueDate ? new Date(invoice.issueDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
  return `${clientName} - ${matterName} - ${issueDate}`;
}

export async function getZohoModules(userId) {
  const data = await zohoRequest(userId, 'get', '/crm/v8/settings/modules');
  return data?.modules || [];
}

export async function getZohoModuleFields(userId, moduleApiName) {
  const data = await zohoRequest(userId, 'get', `/crm/v8/settings/fields`, {
    params: { module: moduleApiName },
  });
  return data?.fields || [];
}

export async function getZohoRecord(userId, moduleApiName, recordId) {
  const data = await zohoRequest(userId, 'get', `/crm/v8/${moduleApiName}/${recordId}`);
  return data?.data?.[0] || null;
}

export async function getZohoRelatedRecords(userId, moduleApiName, recordId, relatedListApiName) {
  const data = await zohoRequest(userId, 'get', `/crm/v8/${moduleApiName}/${recordId}/${relatedListApiName}`);
  return data?.data || [];
}

export async function getZohoAttachments(userId, moduleApiName, recordId) {
  const data = await zohoRequest(userId, 'get', `/crm/v8/${moduleApiName}/${recordId}/Attachments`, {
    params: { fields: 'id,File_Name,Created_Time,Modified_Time,Parent_Id,$file_id' },
  });
  return data?.data || [];
}

export async function uploadZohoAttachment(userId, moduleApiName, recordId, payload = {}) {
  const form = new FormData();

  if (payload.attachmentUrl) {
    form.append('attachmentUrl', payload.attachmentUrl);
    if (payload.title) form.append('title', payload.title);
  } else if (payload.contentBase64 && payload.fileName) {
    const mimeType = payload.mimeType || 'application/octet-stream';
    const buffer = Buffer.from(payload.contentBase64, 'base64');
    const blob = new Blob([buffer], { type: mimeType });
    form.append('file', blob, payload.fileName);
  } else {
    throw new Error('Provide either attachmentUrl or fileName + contentBase64');
  }

  const data = await zohoRequest(userId, 'post', `/crm/v8/${moduleApiName}/${recordId}/Attachments`, {
    data: form,
    headers: form.getHeaders ? form.getHeaders() : undefined,
  });
  return data?.data || data;
}

export async function createZohoActivity(userId, moduleApiName, payload) {
  const data = await zohoRequest(userId, 'post', `/crm/v8/${moduleApiName}`, {
    data: { data: [payload] },
  });
  return data?.data?.[0] || data;
}

export async function listZohoActivityRecords(userId, moduleApiName, params = {}) {
  const data = await zohoRequest(userId, 'get', `/crm/v8/${moduleApiName}`, {
    params,
  });
  return data?.data || [];
}

export async function ensureClientInZoho(userId, clientInput) {
  const client = clientInput instanceof Client ? clientInput : await Client.findById(clientInput);
  if (!client) throw new Error('Client not found');

  const moduleName = client.integrations?.zoho?.crmModule || 'Accounts';
  const record = {
    Account_Name: client.displayName || client.name || 'Unnamed Client',
    Phone: client.phone || undefined,
  };

  let recordId = client.integrations?.zoho?.crmRecordId;
  if (!recordId) {
    const byName = await searchOne(userId, moduleName, 'Account_Name', record.Account_Name);
    recordId = byName?.id || null;
  }

  if (recordId) {
    await updateOne(userId, moduleName, recordId, record);
  } else {
    recordId = await insertOne(userId, moduleName, record);
  }

  client.integrations = {
    ...(client.integrations || {}),
    zoho: {
      ...(client.integrations?.zoho || {}),
      crmModule: moduleName,
      crmRecordId: recordId,
      lastSyncedAt: new Date(),
    },
  };
  await client.save();

  return { moduleName, recordId };
}

export async function ensureClientContactsInZoho(userId, clientInput, zohoAccountRecordId = null) {
  const client = clientInput instanceof Client ? clientInput : await Client.findById(clientInput);
  if (!client) throw new Error('Client not found');

  const contacts = Array.isArray(client.contacts) ? client.contacts : [];
  const results = [];

  for (let index = 0; index < contacts.length; index += 1) {
    const contact = contacts[index];
    const { firstName, lastName } = splitName(contact.name || '');
    const record = {
      Last_Name: lastName,
      First_Name: firstName || undefined,
      Email: contact.email || undefined,
      Phone: contact.phone || undefined,
    };

    if (zohoAccountRecordId) {
      record.Account_Name = { id: zohoAccountRecordId };
    }

    let recordId = contact?.integrations?.zoho?.crmRecordId || null;
    if (!recordId && contact.email) {
      const byEmail = await searchOne(userId, 'Contacts', 'Email', contact.email);
      recordId = byEmail?.id || null;
    }
    if (!recordId) {
      const byName = await searchOne(userId, 'Contacts', 'Last_Name', record.Last_Name);
      recordId = byName?.id || null;
    }

    if (recordId) {
      await updateOne(userId, 'Contacts', recordId, record);
    } else {
      recordId = await insertOne(userId, 'Contacts', record);
    }

    client.contacts[index] = {
      ...contact,
      integrations: {
        ...(contact.integrations || {}),
        zoho: {
          ...(contact.integrations?.zoho || {}),
          crmRecordId: recordId,
          lastSyncedAt: new Date(),
        },
      },
    };
    results.push({
      ok: true,
      email: contact.email || null,
      name: contact.name || null,
      recordId,
    });
  }

  if (results.length) {
    await client.save();
  }

  return results;
}

export async function ensureCaseInZoho(userId, caseInput, clientInput, zohoClientRecordId = null) {
  const matter = caseInput instanceof Case ? caseInput : await Case.findById(caseInput);
  if (!matter) throw new Error('Case not found');
  const client = clientInput instanceof Client ? clientInput : await Client.findById(clientInput || matter.clientId);
  if (!client) throw new Error('Client not found for case');

  const moduleName = matter.integrations?.zoho?.crmModule || process.env.ZOHO_CRM_MATTERS_MODULE || 'Deals';
  const titleField = process.env.ZOHO_CRM_MATTER_NAME_FIELD || 'Deal_Name';
  const accountLookupField = process.env.ZOHO_CRM_MATTER_ACCOUNT_FIELD || 'Account_Name';

  const record = {
    [titleField]: matter.title || matter.name || 'Untitled Matter',
    Description: matter.description || undefined,
  };

  if (moduleName === 'Deals') {
    record.Stage = matter.status === 'closed' ? 'Closed Won' : 'Qualification';
  }

  if (zohoClientRecordId) {
    record[accountLookupField] = { id: zohoClientRecordId };
  }

  let recordId = matter.integrations?.zoho?.crmRecordId;
  if (!recordId) {
    const byTitle = await searchOne(userId, moduleName, titleField, record[titleField]);
    recordId = byTitle?.id || null;
  }

  if (recordId) {
    await updateOne(userId, moduleName, recordId, record);
  } else {
    recordId = await insertOne(userId, moduleName, record);
  }

  matter.integrations = {
    ...(matter.integrations || {}),
    zoho: {
      ...(matter.integrations?.zoho || {}),
      crmModule: moduleName,
      crmRecordId: recordId,
      lastSyncedAt: new Date(),
    },
  };
  await matter.save();

  return { moduleName, recordId };
}

export async function ensureInvoiceInZoho(userId, invoiceInput) {
  const invoice = invoiceInput instanceof Invoice ? invoiceInput : await Invoice.findById(invoiceInput);
  if (!invoice) throw new Error('Invoice not found');

  const client = await Client.findById(invoice.clientId);
  const matter = invoice.caseId ? await Case.findById(invoice.caseId) : null;
  if (!client) throw new Error('Client not found for invoice');

  const syncedClient = await ensureClientInZoho(userId, client);
  const syncedContacts = await ensureClientContactsInZoho(userId, client, syncedClient.recordId);
  const primaryContactId = syncedContacts[0]?.recordId || null;
  const syncedMatter = matter ? await ensureCaseInZoho(userId, matter, client, syncedClient.recordId) : null;

  const moduleName = invoice.integrations?.zoho?.crmModule || 'Invoices';
  const record = {
    Subject: invoiceSubject(invoice, client, matter),
    Account_Name: { id: syncedClient.recordId },
    Invoice_Date: invoice.issueDate ? new Date(invoice.issueDate).toISOString().slice(0, 10) : undefined,
    Due_Date: invoice.dueDate ? new Date(invoice.dueDate).toISOString().slice(0, 10) : undefined,
    Invoiced_Items: (invoice.items || []).map((item) => ({
      Description: item.description || 'Professional services',
      Quantity: Number(((item.durationMinutes || 0) / 60).toFixed(2)) || 1,
      List_Price: Number(item.rate || 0),
      Total: Number(item.amount || 0),
    })),
  };

  if (primaryContactId) {
    record.Contact_Name = { id: primaryContactId };
  }
  if (syncedMatter?.recordId && (process.env.ZOHO_CRM_INVOICE_MATTER_LOOKUP_FIELD || 'Deal_Name')) {
    record[process.env.ZOHO_CRM_INVOICE_MATTER_LOOKUP_FIELD || 'Deal_Name'] = { id: syncedMatter.recordId };
  }

  let recordId = invoice.integrations?.zoho?.crmRecordId || null;
  if (!recordId) {
    const bySubject = await searchOne(userId, moduleName, 'Subject', record.Subject);
    recordId = bySubject?.id || null;
  }

  if (recordId) {
    await updateOne(userId, moduleName, recordId, record);
  } else {
    recordId = await insertOne(userId, moduleName, record);
  }

  invoice.integrations = {
    ...(invoice.integrations || {}),
    zoho: {
      ...(invoice.integrations?.zoho || {}),
      crmModule: moduleName,
      crmRecordId: recordId,
      lastSyncedAt: new Date(),
    },
  };
  await invoice.save();

  return {
    moduleName,
    recordId,
    accountRecordId: syncedClient.recordId,
    contactRecordId: primaryContactId,
    matterRecordId: syncedMatter?.recordId || null,
  };
}

export async function fetchZohoCurrentUser(userId) {
  const data = await zohoRequest(userId, 'get', '/crm/v8/users', {
    params: { type: 'CurrentUser' },
  });
  return data?.users?.[0] || null;
}
