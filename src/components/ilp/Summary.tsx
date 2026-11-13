import { useMemo } from 'react';
import { ILP_DEFAULT_NOTES, WELCOME_BONUS_YEARS, simulateIlp } from '../../lib/ilp';
import { pct, readStored, sgd } from '../../lib/storage';
import { DEFAULTS, STORAGE_KEY, YEARS, toParams, type State } from './state';

// Report summary for the ILP vs DIY page: tables only, from the saved inputs.

export const storageKey = STORAGE_KEY;

const Unverified = () => <span className="tag-unsure">unverified</span>;
const points = (n: number | null) => (n === null ? 'n/a: the account ends at zero' : `${(n * 100).toFixed(2)} points a year`);

export default function Summary() {
  const { o, tableRate, manual, r } = useMemo(() => {
    const o = readStored<State>(storageKey, DEFAULTS);
    const { params, tableRate, manual } = toParams(o);
    return { o, tableRate, manual, r: simulateIlp(params) };
  }, []);

  const nothingPaid = r.paidIn <= 0;
  const diff = r.ilp.finalValue - r.diy.finalValue;
  const diffPct = r.diy.finalValue > 0 ? diff / r.diy.finalValue : null;
  const payYears = o.keepPaying ? YEARS : Math.min(o.iipYears, YEARS);
  const welcomeText = o.bonusFromTable
    ? tableRate === null
      ? 'n/a: the base premium is below the lowest band in the bonus table, so none is applied'
      : `${tableRate}% of the base premium in each of years 1 to ${WELCOME_BONUS_YEARS}`
    : manual.map((v, i) => `year ${i + 1}: ${v}%`).join(', ');
  // The tag stays only while the figure is still the unconfirmed default.
  const flag = (k: keyof State) => o[k] === DEFAULTS[k];
  const unverified = ILP_DEFAULT_NOTES.filter((n) => !n.verified).length;

  const entered: { label: string; value: string; tag?: boolean }[] = [
    { label: 'Base premium a year', value: sgd(o.basePremium) },
    { label: 'Top-up each month', value: sgd(o.monthlyTopUp) },
    { label: 'Initial investment period', value: `${o.iipYears} years` },
    { label: 'Premiums and top-ups paid for', value: `${payYears} years` },
    { label: 'Return before charges', value: `${o.grossReturnPct}% a year` },
    { label: 'ILP fund fee', value: `${o.ilpFundFeePct}% a year`, tag: flag('ilpFundFeePct') },
    {
      label: 'Supplementary charge',
      value: `${o.suppChargePct}% a year for ${o.suppChargeYears} years${o.suppOnTopUps ? ', top-up units included' : ', top-up units excluded'}`,
      tag: flag('suppChargePct') && flag('suppChargeYears'),
    },
    { label: 'Charge on each top-up', value: `${o.topUpChargePct}%`, tag: flag('topUpChargePct') },
    { label: 'Welcome bonus', value: welcomeText, tag: o.bonusFromTable && tableRate !== null },
    {
      label: 'Special bonus',
      value: `${o.specialBonusPct}% of the base premium from annual premium ${o.specialBonusFromYear}, ${o.specialBonusLaterPct}% from annual premium ${o.specialBonusLaterFromYear}`,
      tag: flag('specialBonusPct') && flag('specialBonusFromYear') && flag('specialBonusLaterPct') && flag('specialBonusLaterFromYear'),
    },
    { label: 'VWRA total expense ratio', value: `${o.diyTerPct}% a year` },
    {
      label: 'Brokerage commission',
      value: `${sgd(o.diyCommission, 2)} per purchase, ${o.diyPurchasesPerYear} a year`,
      tag: flag('diyCommission'),
    },
  ];

  const result: { label: string; value: string }[] = nothingPaid
    ? [{ label: `ILP minus DIY after ${YEARS} years`, value: 'n/a: no premium or top-up was entered' }]
    : [
        { label: `ILP minus DIY after ${YEARS} years`, value: `${sgd(diff)} (${pct(diffPct)})` },
        { label: 'ILP final value', value: sgd(r.ilp.finalValue) },
        { label: 'DIY (VWRA) final value', value: sgd(r.diy.finalValue) },
        { label: 'Paid in, either route', value: sgd(r.paidIn) },
        { label: 'ILP total charges', value: sgd(r.ilp.totalCharges) },
        { label: 'DIY total charges', value: sgd(r.diy.totalCharges) },
        { label: 'ILP reduction in yield', value: points(r.ilp.reductionInYield) },
        { label: 'DIY reduction in yield', value: points(r.diy.reductionInYield) },
      ];

  return (
    <>
      <div className="report-pair">
        <div className="table-scroll">
          <table className="data">
            <thead>
              <tr>
                <th>What you entered</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {entered.map((e) => (
                <tr key={e.label}>
                  <td className="wrap-cell">
                    {e.label} {e.tag && <Unverified />}
                  </td>
                  <td className="wrap-cell">{e.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="table-scroll">
          <table className="data">
            <thead>
              <tr>
                <th>Result</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {result.map((f, i) => (
                <tr key={f.label}>
                  <td className="wrap-cell">{i === 0 ? <strong>{f.label}</strong> : f.label}</td>
                  <td>{i === 0 ? <strong>{f.value}</strong> : f.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="warn">
        <ul>
          <li>
            <strong>The ILP modelled.</strong> A regular-premium investment-linked policy with charges like those of AIA
            Pro Achiever 3.0.
          </li>
          <li>
            <strong>
              {unverified} of the {ILP_DEFAULT_NOTES.length} starting figures are unconfirmed.
            </strong>{' '}
            They could not be checked against the insurer’s own documents. Rows tagged unverified still use one.
          </li>
          <li>
            <strong>Not modelled.</strong> Insurance cover, its cost, and surrender or other early-exit charges. Every
            premium is assumed to be paid on time.
          </li>
        </ul>
      </div>

      {!nothingPaid && (
        <>
          <div className="table-scroll">
            <table className="data">
              <thead>
                <tr>
                  <th>Over {YEARS} years</th>
                  <th>ILP</th>
                  <th>DIY (VWRA)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="wrap-cell">Supplementary charge</td>
                  <td>{sgd(r.ilp.supplementary)}</td>
                  <td>Does not apply</td>
                </tr>
                <tr>
                  <td className="wrap-cell">Fund fee (ILP) or TER (VWRA)</td>
                  <td>{sgd(r.ilp.fundFee)}</td>
                  <td>{sgd(r.diy.ter)}</td>
                </tr>
                <tr>
                  <td className="wrap-cell">Charge on top-ups</td>
                  <td>{sgd(r.ilp.topUpCharge)}</td>
                  <td>Does not apply</td>
                </tr>
                <tr>
                  <td className="wrap-cell">Brokerage commissions</td>
                  <td>Does not apply</td>
                  <td>{sgd(r.diy.commissions)}</td>
                </tr>
                <tr>
                  <td className="wrap-cell">
                    <strong>Total charges</strong>
                  </td>
                  <td>
                    <strong>{sgd(r.ilp.totalCharges)}</strong>
                  </td>
                  <td>
                    <strong>{sgd(r.diy.totalCharges)}</strong>
                  </td>
                </tr>
                <tr>
                  <td className="wrap-cell">Welcome bonus received</td>
                  <td>{sgd(r.ilp.welcomeBonus)}</td>
                  <td>Does not apply</td>
                </tr>
                <tr>
                  <td className="wrap-cell">Special bonus received</td>
                  <td>{sgd(r.ilp.specialBonus)}</td>
                  <td>Does not apply</td>
                </tr>
                <tr>
                  <td className="wrap-cell">Return before charges</td>
                  <td>{pct(o.grossReturnPct / 100, 2)}</td>
                  <td>{pct(o.grossReturnPct / 100, 2)}</td>
                </tr>
                <tr>
                  <td className="wrap-cell">Return you get a year</td>
                  <td>{r.ilp.irr === null ? 'n/a: the account ends at zero' : pct(r.ilp.irr, 2)}</td>
                  <td>{r.diy.irr === null ? 'n/a: the account ends at zero' : pct(r.diy.irr, 2)}</td>
                </tr>
                <tr>
                  <td className="wrap-cell">Reduction in yield (points a year)</td>
                  <td>{r.ilp.reductionInYield === null ? 'n/a' : (r.ilp.reductionInYield * 100).toFixed(2)}</td>
                  <td>{r.diy.reductionInYield === null ? 'n/a' : (r.diy.reductionInYield * 100).toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="table-scroll">
            <table className="data">
              <thead>
                <tr>
                  <th>Year</th>
                  <th>Paid in</th>
                  <th>ILP value</th>
                  <th>DIY value</th>
                  <th>ILP minus DIY</th>
                </tr>
              </thead>
              <tbody>
                {r.rows.map((x) => (
                  <tr key={x.year}>
                    <td>{x.year}</td>
                    <td>{sgd(x.paidIn)}</td>
                    <td>{sgd(x.ilp)}</td>
                    <td>{sgd(x.diy)}</td>
                    <td>{sgd(x.ilp - x.diy)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
