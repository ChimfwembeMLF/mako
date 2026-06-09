import React from "react";

interface BillingRecord {
  deposit_id: string;
  status: string;
  amount: number;
  currency: string;
  provider: string | null;
  created_at: string;
}

export function TenantBillingRecords({ tenantId }: { tenantId: string }) {
  const [records, setRecords] = React.useState<BillingRecord[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    fetch(`/rest/v1/pawa_deposits?tenant_id=eq.${tenantId}&order=created_at.desc`, {
      headers: {
        'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
    })
      .then(res => res.ok ? res.json() : Promise.reject(res))
      .then(setRecords)
      .catch(() => setError("Failed to load billing records."))
      .finally(() => setLoading(false));
  }, [tenantId]);

  if (!tenantId) return <div>Tenant ID required.</div>;
  if (loading) return <div>Loading billing records...</div>;
  if (error) return <div>{error}</div>;
  if (!records.length) return <div>No billing records found.</div>;

  return (
    <div style={{marginTop:16}}>
      <h3>Billing Records</h3>
      <table style={{width:'100%', borderCollapse:'collapse'}}>
        <thead>
          <tr>
            <th style={{textAlign:'left'}}>Date</th>
            <th>Status</th>
            <th>Amount</th>
            <th>Currency</th>
            <th>Provider</th>
            <th>Deposit ID</th>
          </tr>
        </thead>
        <tbody>
          {records.map(r => (
            <tr key={r.deposit_id}>
              <td>{new Date(r.created_at).toLocaleString()}</td>
              <td>{r.status}</td>
              <td>{r.amount}</td>
              <td>{r.currency}</td>
              <td>{r.provider || '-'}</td>
              <td style={{fontSize:12}}>{r.deposit_id}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
