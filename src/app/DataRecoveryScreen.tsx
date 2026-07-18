import { useState } from 'react';

export function DataRecoveryScreen({ onReset }: { onReset: () => void }) {
  const [confirming, setConfirming] = useState(false);

  return (
    <main className="entry-page">
      <section className="entry-card card">
        <h1>本地数据无法读取</h1>
        <p>
          浏览器里的约会数据可能不完整。你可以重置本应用的数据后重新开始，其他网站和浏览器设置不会受影响。
        </p>
        <button type="button" onClick={() => setConfirming(true)}>
          重置约会数据
        </button>

        {confirming && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-confirmation-title"
          >
            <h2 id="reset-confirmation-title">确认重置约会数据吗？</h2>
            <p>现有的本地空闲时间、预约和提醒会被删除。</p>
            <button type="button" onClick={onReset}>
              确认重置
            </button>
            <button type="button" onClick={() => setConfirming(false)}>
              返回
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
