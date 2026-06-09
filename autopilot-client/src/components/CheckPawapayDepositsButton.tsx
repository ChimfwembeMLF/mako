import React from "react";

export function CheckPawapayDepositsButton() {
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<string | null>(null);

  const handleClick = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(
        "https://lgstaefowxiovnamacev.supabase.co/functions/v1/check-pawapay-deposits",
        { method: "POST" }
      );
      const data = await res.json();
      setResult(JSON.stringify(data, null, 2));
    } catch (e) {
      setResult("Error: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button onClick={handleClick} disabled={loading} style={{padding:8, borderRadius:4, background:'#2563eb', color:'#fff'}}>
        {loading ? "Checking..." : "Check PawaPay Deposits"}
      </button>
      {result && (
        <pre style={{marginTop:12, background:'#f3f4f6', padding:12, borderRadius:4}}>{result}</pre>
      )}
    </div>
  );
}
