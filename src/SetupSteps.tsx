import { ChevronRight, Check, X } from 'lucide-react'

type Step = { label: string; value: string; done: boolean; onClick: () => void }
export default function SetupSteps({ steps, onDismiss }: { steps: Step[]; onDismiss: () => void }) {
  const completed = steps.filter(step => step.done).length
  const next = steps.findIndex(step => !step.done)
  return <section className="setup-steps" aria-label="初期設定">
    <div className="setup-steps-heading"><h2>初期設定</h2><span role="status">{completed} / {steps.length} 完了</span>{completed === steps.length && <button className="icon-button" aria-label="初期設定を閉じる" onClick={onDismiss}><X size={17} /></button>}</div>
    <ol className="setup-step-list">{steps.map((step, index) => <li key={step.label}>
      <button className={`setup-step ${step.done ? 'done' : ''} ${index === next ? 'next' : ''}`} onClick={step.onClick} aria-current={index === next ? 'step' : undefined}>
        <span className="setup-step-title">{step.done && <Check size={14} aria-label="設定済み" />}{step.label}</span>
        {step.done ? <span className="setup-step-value">{step.value}</span> : <ChevronRight size={15} aria-hidden="true" />}
      </button>
    </li>)}</ol>
  </section>
}
