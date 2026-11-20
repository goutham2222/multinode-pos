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
    { label: "Classic Tautology (' OR '1'='1)", value: "' OR '1'='1" },
    { label: "Union Attack (' UNION SELECT 99999...)", value: "' UNION SELECT 99999, 'Injected Data', 0.00, 0 --" },
    { label: "Legitimate Search (Wardrobe)", value: "Wardrobe" },
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
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-xs">
        <div className="flex items-center space-x-2.5">
          <ShieldCheck className="h-6 w-6 text-emerald-600" />
          <h2 className="text-lg font-bold text-slate-900">SQL Injection Defense & Parameterization Playground</h2>
        </div>
        <p className="text-xs text-slate-500 mt-1 max-w-3xl leading-relaxed">
          Demonstrates how MultiNode POS backend neutralizes SQL injection attacks using database-level parameterized prepared statements
          with native driver bindings against MariaDB Galera.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Controls Card */}
        <div className="bg-white border border-slate-200/80 p-6 rounded-2xl space-y-5 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
            <Lock className="h-4 w-4 text-emerald-600" />
            <span>Interactive Injection Payload Builder</span>
          </h3>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5">Preset Attack Vectors</label>
            <div className="flex flex-wrap gap-2">
              {presets.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => setSearchTerm(p.value)}
                  className={`text-xs px-3 py-1.5 rounded-lg border text-left font-medium transition-all ${
                    searchTerm === p.value
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-bold'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5">Search Parameter Input (Simulated Payload)</label>
            <textarea
              rows={3}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-900 font-mono focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
            <div>
              <span className="font-bold text-slate-800 block text-sm">Prepared Statement Protection</span>
              <span className="text-xs text-slate-500">
                {usePrepared ? 'Uses %s parameter placeholders & binary protocol' : 'Vulnerable string interpolation'}
              </span>
            </div>
            <button
              onClick={() => setUsePrepared(!usePrepared)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-2xs ${
                usePrepared
                  ? 'bg-emerald-600 text-white'
                  : 'bg-rose-600 text-white'
              }`}
            >
              {usePrepared ? 'SAFE (Prepared)' : 'UNSAFE (Direct String)'}
            </button>
          </div>

          <button
            onClick={handleExecute}
            disabled={loading}
            className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center justify-center space-x-2 transition-all shadow-xs"
          >
            <Play className="h-4 w-4" />
            <span>{loading ? 'Evaluating Query...' : 'Execute Payload against Galera'}</span>
          </button>
        </div>

        {/* Results Card */}
        <div className="bg-white border border-slate-200/80 p-6 rounded-2xl space-y-5 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
            <Terminal className="h-4 w-4 text-emerald-600" />
            <span>Execution Analysis & Driver Behavior</span>
          </h3>

          {!result ? (
            <div className="py-20 text-center text-xs text-slate-400 font-medium">
              Click &quot;Execute Payload against Galera&quot; to inspect query sanitization in action.
            </div>
          ) : (
            <div className="space-y-4 text-xs">
              <div
                className={`p-4 rounded-xl border ${
                  result.safe_mode
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}
              >
                <div className="flex items-center space-x-2 font-bold mb-1 text-sm">
                  {result.safe_mode ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-rose-600" />
                  )}
                  <span>{result.safe_mode ? 'Defense Succeeded' : 'Vulnerability Exposed'}</span>
                </div>
                <p className="text-xs leading-relaxed opacity-90">{result.defense_summary}</p>
              </div>

              <div>
                <span className="text-slate-600 font-bold block mb-1">Parameterized SQL Template:</span>
                <pre className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono text-emerald-800 overflow-x-auto whitespace-pre-wrap font-bold">
                  {result.query_template}
                </pre>
              </div>

              {result.bound_parameters && (
                <div>
                  <span className="text-slate-600 font-bold block mb-1">Bound Data Scalars:</span>
                  <pre className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-700 overflow-x-auto">
                    {JSON.stringify(result.bound_parameters, null, 2)}
                  </pre>
                </div>
              )}

              <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-600 font-medium">Rows Matched:</span>
                <span className="font-mono font-bold text-slate-900 text-sm">{result.row_count} rows</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
