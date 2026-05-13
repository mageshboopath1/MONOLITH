import React from 'react';

interface DataTableProps {
  data: any[];
}

export const DataTable: React.FC<DataTableProps> = ({ data }) => {
  if (!data || data.length === 0) return null;
  
  // Extract headers from the first object
  const headers = Object.keys(data[0]);

  return (
    <div className="my-6 overflow-hidden border border-zinc-800 bg-zinc-950/50 shadow-2xl">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/30">
              {headers.map((header) => (
                <th 
                  key={header} 
                  className="px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 border-r border-zinc-800 last:border-0"
                >
                  {header.replace(/_/g, ' ')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, rowIndex) => (
              <tr 
                key={rowIndex} 
                className="border-b border-zinc-900 last:border-0 hover:bg-white/[0.02] transition-colors group"
              >
                {headers.map((header) => {
                  const value = row[header];
                  const isBoolean = typeof value === 'boolean';
                  const isNumber = typeof value === 'number';
                  
                  return (
                    <td 
                      key={header} 
                      className="px-4 py-3 text-xs font-mono border-r border-zinc-900 last:border-0"
                    >
                      {isBoolean ? (
                        <span className={value ? "text-emerald-500" : "text-zinc-600"}>
                          {value ? 'TRUE' : 'FALSE'}
                        </span>
                      ) : isNumber ? (
                        <span className="text-amber-500/90">{value}</span>
                      ) : (
                        <span className="text-zinc-300 group-hover:text-white transition-colors">
                          {value}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-2 border-t border-zinc-900 bg-zinc-900/20 flex justify-between items-center">
        <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">
          Dataset: {data.length} Records
        </span>
        <div className="flex gap-1">
          <div className="w-1 h-1 bg-zinc-800" />
          <div className="w-1 h-1 bg-zinc-700" />
          <div className="w-1 h-1 bg-zinc-600" />
        </div>
      </div>
    </div>
  );
};
