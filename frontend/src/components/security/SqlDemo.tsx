import React, { useState } from 'react';
import { ShieldCheck, AlertTriangle, Play, Terminal, CheckCircle2, Lock } from 'lucide-react';
import { SqlDemoResult } from '../../types';
import { api } from '../../services/api';

interface SqlDemoProps {
  targetNode: string;
}

export const SqlDemo: React.FC<SqlDemoProps> = ({ targetNode }) => {
  const [searchTerm, setSearchTerm] = useState("' OR '1'='1");
  const [usePrepared, setUsePrepared] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SqlDemoResult | null>(null);

  const presets = [
    { label: "Classic Tautology Bypass (' OR '1'='1)", value: "' OR '1'='1" },
    { label: "Union Data Exfiltration (' UNION SELECT 99999, 'Hacked', ...)", value: "' UNION SELECT 99999, 'Injected Data', 0.00, 0 --" },
    { label: "Legitimate Search Term (Wardrobe)", value: "Wardrobe" },
  ];

  const handleExecute = async () => {
    setLoading(true);
    try {
      const res = await api.runSqlDemo(searchTerm, usePrepared, targetNode);
      setResult(res);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-sm">
        <div className="flex items-center space-x-2">
          <ShieldCheck className="h-6 w-6 text-emerald-400" />
          <h2 className="text-lg font-bold text-slate-100">SQL Injection Defense & Parameterization Playground</h2>
        </div>
        <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
          Demonstrates how MultiNode POS backend neutralizes SQL injection attacks using database-level parameterized prepared statements
          with native driver bindings against MariaDB Galera.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Controls Card */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4 shadow-sm">
          <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
            <Lock className="h-4 w-4 text-emerald-400" />
            <span>Interactive Injection Payload Builder</span>
          </h3>

          <div>
            <label className="block text-xs text-slate-400 mb-1 font-medium">Select a Preset Injection Vector</label>
            <div className="flex flex-wrap gap-2">
              {presets.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => setSearchTerm(p.value)}
                  className={`text-xs px-2.5 py-1.5 rounded-md border text-left transition-all ${
                    searchTerm === p.value
                      ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300 font-semibold'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1 font-medium">Search Parameter Input (Simulated Payload)</label>
            <textarea
              rows={3}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
            <div>
              <span className="font-semibold text-slate-200 block">Prepared Statement Protection</span>
              <span className="text-[11px] text-slate-400">
                {usePrepared ? 'Uses %s parameter placeholders & binary protocol' : 'Vulnerable string interpolation'}
              </span>
            </div>
            <button
              onClick={() => setUsePrepared(!usePrepared)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                usePrepared
                  ? 'bg-emerald-600 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'bg-rose-600 text-white'
              }`}
            >
              {usePrepared ? 'SAFE (Prepared)' : 'UNSAFE (Direct String)'}
            </button>
          </div>

          <button
            onClick={handleExecute}
            disabled={loading}
            className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold rounded-lg text-xs flex items-center justify-center space-x-2 transition-all shadow-md shadow-emerald-500/20"
          >
            <Play className="h-4 w-4" />
            <span>{loading ? 'Evaluating Query...' : 'Execute Payload against Galera'}</span>
          </button>
        </div>

        {/* Results Card */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4 shadow-sm">
          <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
            <Terminal className="h-4 w-4 text-emerald-400" />
            <span>Execution Analysis & Driver Behavior</span>
          </h3>

          {!result ? (
            <div className="py-16 text-center text-xs text-slate-500">
              Click &quot;Execute Payload against Galera&quot; to inspect query sanitization in action.
            </div>
          ) : (
            <div className="space-y-4 text-xs">
              <div
                className={`p-3 rounded-lg border ${
                  result.safe_mode
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                }`}
              >
                <div className="flex items-center space-x-2 font-bold mb-1">
                  {result.safe_mode ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-rose-400" />
                  )}
                  <span>{result.safe_mode ? 'Defense Succeeded' : 'Vulnerability Exposed'}</span>
                </div>
                <p className="text-[11px] leading-relaxed opacity-90">{result.defense_summary}</p>
              </div>

              <div>
                <span className="text-slate-400 font-semibold block mb-1">Parameterized SQL Template:</span>
                <pre className="p-2.5 rounded bg-slate-950 border border-slate-800 text-[11px] font-mono text-emerald-300 overflow-x-auto whitespace-pre-wrap">
                  {result.query_template}
                </pre>
              </div>

              {result.bound_parameters && (
                <div>
                  <span className="text-slate-400 font-semibold block mb-1">Bound Data Scalars:</span>
                  <pre className="p-2.5 rounded bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto">
                    {JSON.stringify(result.bound_parameters, null, 2)}
                  </pre>
                </div>
              )}

              <div className="flex items-center justify-between p-2.5 bg-slate-950 rounded border border-slate-800">
                <span className="text-slate-400">Rows Matched:</span>
                <span className="font-mono font-bold text-slate-200">{result.row_count} rows</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
