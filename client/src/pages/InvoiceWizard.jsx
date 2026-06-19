import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Stepper from '../components/Stepper';
import ClientAutocomplete from '../components/ClientAutocomplete';
import LineItemTable, { calculateReceivable } from '../components/LineItemTable';
import PaymentAccountSelect, {
  emptyPaymentAccount,
  paymentAccountFromInvoice,
} from '../components/PaymentAccountSelect';
import PaymentHistory, {
  emptyPaymentEntry,
  calculatePaymentTotals,
} from '../components/PaymentHistory';
import CurrencySelect from '../components/CurrencySelect';
import {
  upsertClient,
  createInvoice,
  updateInvoice,
  getInvoice,
  getCompany,
  getNextInvoiceNumber,
  autosaveInvoice,
  addInvoicePayment,
  deleteInvoicePayment,
  getInvoicePdfUrl,
} from '../api/client';
import MoneyAmount from '../components/MoneyAmount';

const STEPS = ['Bill To', 'Invoice Details', 'Line Items', 'Payment & Review'];
const DRAFT_STORAGE_KEY = 'invoice-draft-id';

const emptyClient = () => ({
  company_name: '',
  phone: '',
  email: '',
  website: '',
  address: '',
});

const emptyLineItem = () => ({
  heading: '',
  description: '',
  quantity: 1,
  unit_price: 0,
});

function mapLineItems(lineItems) {
  if (!lineItems?.length) return [emptyLineItem()];
  return lineItems.map((item) => ({
    heading: item.heading || '',
    description: item.description || '',
    quantity: item.quantity ?? 1,
    unit_price: item.unit_price ?? 0,
  }));
}

function populateFormFromInvoice(invoice, setters) {
  const {
    setClient,
    setInvoiceNumber,
    setInvoiceDate,
    setNotes,
    setLineItems,
    setPayments,
    setCurrencyText,
    setSavedInvoiceId,
    setPaymentAccount,
    setIsFinalized,
  } = setters;

  setClient({
    company_name: invoice.client_company_name || '',
    phone: invoice.client_phone || '',
    email: invoice.client_email || '',
    website: invoice.client_website || '',
    address: invoice.client_address || '',
  });
  setInvoiceNumber(invoice.invoice_number || '');
  setInvoiceDate(invoice.invoice_date || '');
  setNotes(invoice.notes || '');
  setLineItems(mapLineItems(invoice.line_items));
  setPayments(invoice.payments || []);
  setCurrencyText(invoice.currency_text || '$');
  setSavedInvoiceId(invoice.id);
  setPaymentAccount(paymentAccountFromInvoice(invoice));
  setIsFinalized(!invoice.is_draft);
}

export default function InvoiceWizard() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);

  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(isEditing);
  const [saveStatus, setSaveStatus] = useState('');
  const [savedInvoiceId, setSavedInvoiceId] = useState(isEditing ? Number(id) : null);

  const [client, setClient] = useState(emptyClient());
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState([emptyLineItem()]);
  const [payments, setPayments] = useState([]);
  const [newPayment, setNewPayment] = useState(emptyPaymentEntry());
  const [addingPayment, setAddingPayment] = useState(false);
  const [currencyText, setCurrencyText] = useState('$');
  const [paymentAccount, setPaymentAccount] = useState(emptyPaymentAccount());
  const [isFinalized, setIsFinalized] = useState(false);

  const autoSaveInFlight = useRef(false);
  const formRef = useRef({
    client,
    invoiceNumber,
    invoiceDate,
    notes,
    lineItems,
    savedInvoiceId,
    paymentAccount,
    currencyText,
  });

  useEffect(() => {
    formRef.current = {
      client,
      invoiceNumber,
      invoiceDate,
      notes,
      lineItems,
      savedInvoiceId,
      paymentAccount,
      currencyText,
    };
  }, [client, invoiceNumber, invoiceDate, notes, lineItems, savedInvoiceId, paymentAccount, currencyText]);

  useEffect(() => {
    if (isEditing) {
      loadInvoice(id);
      return;
    }

    async function initNewInvoice() {
      try {
        const company = await getCompany();
        setCurrencyText(company.currency_text || '$');

        const draftId = localStorage.getItem(DRAFT_STORAGE_KEY);
        if (draftId) {
          const draft = await getInvoice(draftId);
          if (draft.is_draft) {
            populateFormFromInvoice(draft, {
              setClient,
              setInvoiceNumber,
              setInvoiceDate,
              setNotes,
              setLineItems,
              setPayments,
              setCurrencyText,
              setSavedInvoiceId,
              setPaymentAccount,
              setIsFinalized,
            });
            return;
          }
          localStorage.removeItem(DRAFT_STORAGE_KEY);
        }

        const { invoice_number } = await getNextInvoiceNumber();
        setInvoiceNumber(invoice_number);
      } catch {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
      }
    }

    initNewInvoice();
  }, [id, isEditing]);

  async function loadInvoice(invoiceId) {
    setLoading(true);
    setError('');

    try {
      const invoice = await getInvoice(invoiceId);
      populateFormFromInvoice(invoice, {
        setClient,
        setInvoiceNumber,
        setInvoiceDate,
        setNotes,
        setLineItems,
        setPayments,
        setCurrencyText,
        setSavedInvoiceId,
        setPaymentAccount,
        setIsFinalized,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const handleAutoSave = useCallback(async () => {
    const {
      client: currentClient,
      invoiceNumber: currentInvoiceNumber,
      invoiceDate: currentInvoiceDate,
      notes: currentNotes,
      lineItems: currentLineItems,
      savedInvoiceId: currentSavedInvoiceId,
      paymentAccount: currentPaymentAccount,
      currencyText: currentCurrencyText,
    } = formRef.current;

    if (!currentInvoiceNumber.trim() || autoSaveInFlight.current || submitting) {
      return;
    }

    autoSaveInFlight.current = true;
    setSaveStatus('Saving...');

    try {
      const saved = await autosaveInvoice({
        id: currentSavedInvoiceId || undefined,
        invoice_number: currentInvoiceNumber,
        invoice_date: currentInvoiceDate,
        client: currentClient,
        line_items: currentLineItems,
        notes: currentNotes || null,
        payment_account: currentPaymentAccount,
        currency_text: currentCurrencyText,
      });

      setSavedInvoiceId(saved.id);
      if (saved.invoice_number) {
        setInvoiceNumber(saved.invoice_number);
      }
      if (!isEditing) {
        localStorage.setItem(DRAFT_STORAGE_KEY, String(saved.id));
      }
      setSaveStatus('Saved');
    } catch (err) {
      setSaveStatus('');
      setError(err.message);
    } finally {
      autoSaveInFlight.current = false;
    }
  }, [isEditing, submitting]);

  const receivable = calculateReceivable(lineItems);
  const paymentTotals = calculatePaymentTotals(receivable, payments);

  function addLocalPayment() {
    const amount = Number(newPayment.amount);
    if (!amount || amount <= 0) {
      setError('Enter a payment amount greater than zero');
      return;
    }

    setPayments((prev) => [
      ...prev,
      {
        amount,
        payment_date: newPayment.payment_date,
        notes: newPayment.notes || '',
      },
    ]);
    setNewPayment(emptyPaymentEntry());
    setError('');
  }

  async function handleRecordPayment() {
    const amount = Number(newPayment.amount);
    if (!amount || amount <= 0) {
      setError('Enter a payment amount greater than zero');
      return;
    }

    setAddingPayment(true);
    setError('');

    try {
      const updated = await addInvoicePayment(id, {
        amount,
        payment_date: newPayment.payment_date,
        notes: newPayment.notes || null,
      });

      setPayments(updated.payments || []);
      setNewPayment(emptyPaymentEntry());
      window.open(getInvoicePdfUrl(updated.id, Date.now()), '_blank');
    } catch (err) {
      setError(err.message);
    } finally {
      setAddingPayment(false);
    }
  }

  async function handleDeletePayment(payment) {
    const confirmed = window.confirm('Remove this payment from the invoice history?');
    if (!confirmed) return;

    setError('');
    try {
      const updated = await deleteInvoicePayment(id, payment.id);
      setPayments(updated.payments || []);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleNext() {
    setError('');

    if (step === 0) {
      if (!client.company_name.trim()) {
        setError('Client company name is required');
        return;
      }
      try {
        await upsertClient(client);
      } catch (err) {
        setError(err.message);
        return;
      }
    }

    if (step === 1) {
      if (!invoiceDate) {
        setError('Invoice date is required');
        return;
      }
    }

    if (step === 2) {
      const validItems = lineItems.filter(
        (item) => item.heading.trim() || item.description.trim() || item.unit_price > 0
      );
      if (validItems.length === 0) {
        setError('Add at least one line item');
        return;
      }
    }

    await handleAutoSave();
    setStep(step + 1);
  }

  function handleBack() {
    setError('');
    setStep(step - 1);
  }

  const invoicePayload = {
    id: savedInvoiceId || undefined,
    invoice_number: invoiceNumber,
    invoice_date: invoiceDate,
    client,
    line_items: lineItems,
    notes: notes || null,
    payment_account: paymentAccount,
    currency_text: currencyText,
    payments: isEditing ? undefined : payments,
  };

  async function handleSubmit() {
    setError('');
    setSubmitting(true);

    try {
      const invoice = isEditing
        ? await updateInvoice(id, invoicePayload)
        : await createInvoice(invoicePayload);

      localStorage.removeItem(DRAFT_STORAGE_KEY);
      window.open(getInvoicePdfUrl(invoice.id, Date.now()), '_blank');
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p className="loading">Loading invoice...</p>;

  return (
    <div className="page">
      <div className="page-header">
        <h1>{isEditing ? 'Edit Invoice' : 'New Invoice'}</h1>
        {saveStatus && <span className="save-status">{saveStatus}</span>}
      </div>
      <Stepper steps={STEPS} currentStep={step} />

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card wizard-content">
        {step === 0 && (
          <div className="form-grid">
            <ClientAutocomplete
              value={client}
              onChange={setClient}
              onSelect={setClient}
              onFieldBlur={handleAutoSave}
            />
            <label>
              Phone
              <input
                type="text"
                value={client.phone}
                onChange={(e) => setClient({ ...client, phone: e.target.value })}
                onBlur={handleAutoSave}
              />
            </label>
            <label>
              Email
              <input
                type="email"
                value={client.email}
                onChange={(e) => setClient({ ...client, email: e.target.value })}
                onBlur={handleAutoSave}
              />
            </label>
            <label>
              Website
              <input
                type="text"
                value={client.website}
                onChange={(e) => setClient({ ...client, website: e.target.value })}
                onBlur={handleAutoSave}
              />
            </label>
            <label className="full-width">
              Address
              <textarea
                value={client.address}
                onChange={(e) => setClient({ ...client, address: e.target.value })}
                onBlur={handleAutoSave}
                rows={3}
              />
            </label>
          </div>
        )}

        {step === 1 && (
          <div className="form-grid">
            <label>
              Invoice Number
              <input type="text" value={invoiceNumber} readOnly className="readonly-input" />
            </label>
            <label>
              Invoice Date *
              <input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                onBlur={handleAutoSave}
                required
              />
            </label>
            <CurrencySelect
              value={currencyText}
              onChange={setCurrencyText}
              onBlur={handleAutoSave}
              label="Currency *"
            />
            <label className="full-width">
              Notes (optional)
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={handleAutoSave}
                rows={3}
                placeholder="Payment terms, thank you note, etc."
              />
            </label>

            <PaymentAccountSelect
              value={paymentAccount}
              onChange={setPaymentAccount}
              onFieldBlur={handleAutoSave}
            />
          </div>
        )}

        {step === 2 && (
          <LineItemTable
            items={lineItems}
            onChange={setLineItems}
            currencyText={currencyText}
            onFieldBlur={handleAutoSave}
          />
        )}

        {step === 3 && (
          <div className="review-section">
            <PaymentHistory
              payments={payments}
              currencyText={currencyText}
              receivable={receivable}
              showForm
              newPayment={newPayment}
              onNewPaymentChange={setNewPayment}
              onAddPayment={isFinalized ? handleRecordPayment : addLocalPayment}
              onDeletePayment={isFinalized ? handleDeletePayment : undefined}
              adding={addingPayment}
              allowDelete={isFinalized}
              addButtonLabel={isFinalized ? 'Record Payment & Regenerate PDF' : 'Add Payment'}
            />

            <div className="review-details">
              <h3>Summary</h3>
              <p><strong>Invoice:</strong> {invoiceNumber} — {invoiceDate}</p>
              <p><strong>Currency:</strong> {currencyText}</p>
              <p><strong>Bill To:</strong> {client.company_name}</p>
              {client.address && <p>{client.address}</p>}
              {paymentAccount.label && (
                <p><strong>Payment A/C:</strong> {paymentAccount.label}</p>
              )}
              <table className="review-table">
                <thead>
                  <tr>
                    <th>Heading</th>
                    <th>Description</th>
                    <th>Qty</th>
                    <th>Rate</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((item, i) => (
                    <tr key={i}>
                      <td>{item.heading}</td>
                      <td>{item.description}</td>
                      <td>{item.quantity}</td>
                      <td><MoneyAmount amount={item.unit_price} currencyText={currencyText} /></td>
                      <td>
                        <MoneyAmount
                          amount={item.quantity * item.unit_price}
                          currencyText={currencyText}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <div className="wizard-actions">
        <button type="button" className="btn-secondary" onClick={() => navigate('/')}>
          Cancel
        </button>
        {step > 0 && (
          <button type="button" className="btn-secondary" onClick={handleBack}>
            Back
          </button>
        )}
        {step < STEPS.length - 1 ? (
          <button type="button" className="btn-primary" onClick={handleNext}>
            Continue
          </button>
        ) : (
          <button
            type="button"
            className="btn-primary"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting
              ? (isEditing ? 'Saving...' : 'Generating...')
              : (isEditing ? 'Save Invoice & Regenerate PDF' : 'Generate PDF')}
          </button>
        )}
        {step === STEPS.length - 1 && isFinalized && (
          <p className="step-hint">
            Use Add Payment to record subsequent payments and regenerate the PDF with updated due.
          </p>
        )}
      </div>
    </div>
  );
}
