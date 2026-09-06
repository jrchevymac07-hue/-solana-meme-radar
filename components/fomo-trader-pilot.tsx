const traders = [
  { name: "Unipcs", handle: "unipcs", displayedPnl: "+$4.7M" },
  { name: "Smokey", handle: "smokey0x", displayedPnl: "+$314.4K" },
  { name: "Rowdy", handle: "Rowdy", displayedPnl: "+$284.4K" },
  { name: "NFTDefiFutures", handle: "NDF_Sonar_trade", displayedPnl: "+$78.3K" },
  { name: "The Night Owl", handle: "TheNightOwl888", displayedPnl: "+$54.3K" },
  { name: "seekingknowledge", handle: "seekingknowledge", displayedPnl: "+$51.2K" },
] as const;

const holdings = [
  { symbol: "PONS", displayedValue: "$9.96M", displayedPnl: "+$9.89M" },
  { symbol: "MarsCoin", displayedValue: "$7.68M", displayedPnl: "+$6.70M" },
  { symbol: "USELESS", displayedValue: "$4.19M", displayedPnl: "+$3.36M" },
  { symbol: "Basecoat", displayedValue: "$1.53M", displayedPnl: "+$1.03M" },
] as const;

export function FomoTraderPilot() {
  return <section className="fomo-pilot">
    <div className="fomo-heading">
      <div>
        <p className="eyebrow">TRADER INTELLIGENCE · PILOT</p>
        <h2>Fomo Research Watch</h2>
        <p>Six visible Fantom Troupe members and four shared positions captured from the 24-hour clan view. These are research observations, not verified returns or trade recommendations.</p>
      </div>
      <div className="fomo-status"><span className="dot" />Observation loaded<small>Observed September 5, 2026 · 24h window</small></div>
    </div>
    <div className="fomo-columns">
      <div>
        <h3>Visible traders</h3>
        <div className="fomo-list">{traders.map((trader) =>
          <a key={trader.handle} href={`https://fomo.family/profile/${trader.handle}`} target="_blank" rel="noreferrer">
            <span><b>{trader.name}</b><small>@{trader.handle}</small></span>
            <strong>{trader.displayedPnl}</strong>
          </a>
        )}</div>
      </div>
      <div>
        <h3>Shared position evidence</h3>
        <div className="fomo-list">{holdings.map((holding) =>
          <div key={holding.symbol}>
            <span><b>{holding.symbol}</b><small>Displayed position value {holding.displayedValue}</small></span>
            <strong>{holding.displayedPnl}</strong>
          </div>
        )}</div>
      </div>
    </div>
    <p className="fomo-footnote">Pilot data has zero weight in Radar Score. The production collector will replace this dated observation when a repeatable authorized feed is available.</p>
  </section>;
}
