'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SetupPage() {
  const router = useRouter();
  const [workspaceName, setWorkspaceName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${apiUrl}/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceName }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message ?? 'Setup failed');
      }

      router.push('/connectors');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 480, margin: '80px auto', padding: '0 24px', fontFamily: 'sans-serif' }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>Welcome to Kairosis</h1>
      <p style={{ color: '#666', marginBottom: 32 }}>Give your workspace a name to get started.</p>

      <form onSubmit={handleSubmit}>
        <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
          Workspace name
        </label>
        <input
          type="text"
          value={workspaceName}
          onChange={(e) => setWorkspaceName(e.target.value)}
          placeholder="My Workspace"
          required
          style={{
            display: 'block', width: '100%', padding: '10px 12px',
            border: '1px solid #d0d0d0', borderRadius: 6, fontSize: 16,
            marginBottom: 16, boxSizing: 'border-box',
          }}
        />
        {error && <p style={{ color: '#c00', marginBottom: 16 }}>{error}</p>}
        <button
          type="submit"
          disabled={loading || !workspaceName.trim()}
          style={{
            padding: '10px 24px', background: '#0070f3', color: '#fff',
            border: 'none', borderRadius: 6, fontSize: 16, cursor: 'pointer',
            opacity: loading || !workspaceName.trim() ? 0.6 : 1,
          }}
        >
          {loading ? 'Setting up…' : 'Create workspace'}
        </button>
      </form>
    </main>
  );
}
