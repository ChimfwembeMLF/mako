import React from 'react';
import { paymentsApi } from '@/lib/api';
import { Button } from '@/components/ui/button';

export function RefreshPendingPaymentsButton() {
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<string | null>(null);

  const handleClick = async () => {
    setLoading(true);
    setResult(null);
    try {
      const data = await paymentsApi.checkPending();
      setResult(`Updated ${data.completed} pending payment(s).`);
    } catch (e) {
      setResult(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Button onClick={handleClick} disabled={loading} size="sm" variant="outline">
        {loading ? 'Checking…' : 'Refresh payment status'}
      </Button>
      {result && <p className="text-xs text-muted-foreground mt-2">{result}</p>}
    </div>
  );
}
