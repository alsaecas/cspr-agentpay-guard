import type { DemoStep } from "@/lib/demoFlow";

export function Timeline({ steps }: { steps: DemoStep[] }) {
  return (
    <div className="timeline">
      {steps.map((step, i) => (
        <div key={i} className={`timeline-step ${step.status}`}>
          <div>
            <div className="timeline-label">{step.label}</div>
            {step.detail && (
              <div className="timeline-detail">{step.detail}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
