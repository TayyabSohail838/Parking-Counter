"use client";

import { memo, useState } from "react";
import s from "./dashboard.module.css";

export const IN_COLOR = "#199e70"; // validated pair on the dark surface (CVD ΔE 9.4)
export const OUT_COLOR = "#d95926";

export interface InOutBucket {
  label: string;
  /** full label for the tooltip, e.g. "08:00–09:00" */
  title: string;
  in: number;
  out: number;
}

function niceMax(v: number) {
  if (v <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(v));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((m) => m * 4 >= v) ?? pow * 10;
  return step * 4;
}

/**
 * Stacked IN/OUT bar chart: thin bars, 4px rounded tops, a 2px gap between
 * segments, recessive grid, a legend, a hover tooltip and a table view.
 */
export const StackedBars = memo(function StackedBars({ data, labelEvery = 1, caption }: {
  data: InOutBucket[];
  labelEvery?: number;
  caption: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);
  const max = niceMax(Math.max(1, ...data.map((d) => d.in + d.out)));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f));
  const h = hover !== null ? data[hover] : null;

  return (
    <figure className={s.chart}>
      {asTable ? (
        <div className={s.tableBox}>
          <table className={s.dataTable}>
            <caption className={s.srOnly}>{caption}</caption>
            <thead>
              <tr>
                <th scope="col">Period</th>
                <th scope="col"><i style={{ background: IN_COLOR }} />In</th>
                <th scope="col"><i style={{ background: OUT_COLOR }} />Out</th>
                <th scope="col">Total</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.title} className={d.in + d.out ? undefined : s.zeroRow}>
                  <td>{d.title}</td><td>{d.in}</td><td>{d.out}</td><td>{d.in + d.out}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
      <>
      <div className={s.legend} aria-hidden>
        <span><i style={{ background: IN_COLOR }} />In</span>
        <span><i style={{ background: OUT_COLOR }} />Out</span>
      </div>

      <div className={s.plot}>
        <div className={s.yAxis} aria-hidden>
          {ticks.slice().reverse().map((t) => <span key={t}>{t}</span>)}
        </div>
        <div className={s.plotArea} onMouseLeave={() => setHover(null)}>
          {ticks.map((t) => (
            <div key={t} className={s.gridLine} style={{ bottom: `${(t / max) * 100}%` }} aria-hidden />
          ))}
          <div className={s.bars} role="img" aria-label={caption}>
            {data.map((d, i) => {
              const total = d.in + d.out;
              return (
                <div
                  key={d.title}
                  className={`${s.barSlot} ${hover === i ? s.barSlotActive : ""}`}
                  onMouseEnter={() => setHover(i)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  tabIndex={total ? 0 : -1}
                  aria-label={`${d.title}: ${d.in} in, ${d.out} out`}
                >
                  <div className={s.stack} style={{ height: `${(total / max) * 100}%` }}>
                    {d.out > 0 && <div style={{ flexGrow: d.out, background: OUT_COLOR }} />}
                    {d.in > 0 && <div style={{ flexGrow: d.in, background: IN_COLOR }} />}
                  </div>
                </div>
              );
            })}
          </div>
          {h && hover !== null && (
            <div
              className={s.tooltip}
              style={{ left: `${((hover + 0.5) / data.length) * 100}%` }}
              role="status"
            >
              <b>{h.title}</b>
              <span><i style={{ background: IN_COLOR }} />In <em>{h.in}</em></span>
              <span><i style={{ background: OUT_COLOR }} />Out <em>{h.out}</em></span>
              <span className={s.tooltipTotal}>Total <em>{h.in + h.out}</em></span>
            </div>
          )}
        </div>
      </div>
      <div className={s.xAxis} aria-hidden>
        {data.map((d, i) => <span key={d.title}>{i % labelEvery === 0 ? d.label : ""}</span>)}
      </div>

      </>
      )}

      <button type="button" className={s.viewToggle} onClick={() => { setAsTable((v) => !v); setHover(null); }} aria-pressed={asTable}>
        {asTable ? "View as chart" : "View as table"}
      </button>
    </figure>
  );
});
