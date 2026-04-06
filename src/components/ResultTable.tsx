import type { AnalyzedItem } from '../types'

interface ResultTableProps {
  items: AnalyzedItem[]
  onUpdateName: (phash: string, newName: string) => void
}

export function ResultTable({ items, onUpdateName }: ResultTableProps) {
  const handleExportCSV = () => {
    const header = 'アイテム名,所持数,pHash\n'
    const rows = items.map(item => `"${item.name || '未登録'}",${item.quantity},${item.phash}`).join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = 'stella_sora_stock.csv'
    link.click()
  }

  return (
    <div className="result-table-container">
      <div className="table-header">
        <h2>解析結果</h2>
        <button className="export-button" onClick={handleExportCSV}>CSVエクスポート</button>
      </div>
      <table className="result-table">
        <thead>
          <tr>
            <th>アイコン</th>
            <th>アイテム名</th>
            <th>所持数</th>
            <th>信頼度</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={item.phash || idx}>
              <td className="col-icon">
                <img src={item.iconDataUrl} alt="icon" className="item-icon-img" />
              </td>
              <td className="col-name">
                <input
                  type="text"
                  value={item.name}
                  placeholder="アイテム名を入力"
                  onChange={(e) => onUpdateName(item.phash, e.target.value)}
                  className="name-input"
                />
              </td>
              <td className="col-quantity">{item.quantity}</td>
              <td className="col-conf">{(item.confidence * 100).toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
