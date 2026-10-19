import { useEffect, useState } from 'react'
import { countdownTo } from './finance'

export default function PaydayCountdown({ date, past }: { date: string; past: boolean }) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const update = () => setNow(Date.now())
    update()
    if (past) return
    const timer = setInterval(update, 1000)
    document.addEventListener('visibilitychange', update)
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', update) }
  }, [date, past])
  if (past) return <div className="payday-countdown countdown-ended">この月期は終了しています</div>
  const { days, hours, minutes, seconds } = countdownTo(date, now)
  return <div className="payday-countdown">
    <span className="countdown-label">次の給料日まで</span>
    <div className="countdown-digits" role="timer" aria-live="off" aria-label={`残り${days}日${hours}時間${minutes}分${seconds}秒`}>
      <span className="countdown-prefix">残り</span>
      {[[days, '日'], [hours, '時間'], [minutes, '分'], [seconds, '秒']].map(([value, unit]) => <span className="countdown-part" key={unit}><strong>{String(value).padStart(2, '0')}</strong><span>{unit}</span></span>)}
    </div>
  </div>
}
