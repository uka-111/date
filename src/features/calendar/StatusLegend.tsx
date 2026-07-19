export function StatusLegend() {
  return (
    <div className="status-legend" aria-label="日历图例">
      <span><i className="legend-swatch legend-confirmed" />已确认行程</span>
      <span><i className="legend-dot legend-him" />他有空</span>
      <span><i className="legend-dot legend-her" />她有空</span>
      <span><i className="legend-dot legend-needs" />待我确认</span>
      <span><i className="legend-dot legend-waiting" />等待对方</span>
      <span><i className="legend-symbol">▣</i>照片</span>
      <span><i className="legend-symbol">✎</i>文字记录</span>
    </div>
  );
}
