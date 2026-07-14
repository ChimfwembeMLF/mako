import { renderInvoicePdf } from './invoice.pdf';
import type { InvoiceData } from './invoice.template';

const sampleInvoice: InvoiceData = {
  invoiceNumber: 'INV-TEST-001',
  depositId: 'b1765e6a-2a94-4fb1-bbea-7bb9d9506cab',
  tenantName: 'Test Workspace',
  customerEmail: 'customer@example.com',
  plan: 'starter',
  planLabel: 'Starter',
  amount: '2685',
  currency: 'KES',
  status: 'Paid',
  paymentMethod: 'Mobile Money',
  network: 'MTN_MOMO_KEN',
  phone: '254712345678',
  issuedAt: new Date().toISOString(),
  paidAt: new Date().toISOString(),
  companyName: 'Mako',
  companyLegalName: 'Agriwide Ltd',
  companyTagline: 'Marketing automation',
  companyAddress: 'Lusaka, Zambia',
  companyTpin: '1234567890',
  companyPhones: '+260 97 000 0000',
  supportEmail: 'support@example.com',
  website: 'https://mako.example.com',
  bankName: 'Zanaco',
  bankBranch: 'Lusaka',
  bankAccountName: 'Agriwide Ltd',
  bankAccountNumber: '0000000000',
  subTotal: '2685',
  vatAmount: '0.00',
  grandTotal: '2685',
};

describe('renderInvoicePdf', () => {
  it('renders a valid PDF buffer for FX-converted deposits', async () => {
    const pdf = await renderInvoicePdf(sampleInvoice);
    expect(pdf.length).toBeGreaterThan(1000);
    expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
  });
});
