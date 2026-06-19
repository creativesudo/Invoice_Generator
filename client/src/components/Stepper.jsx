export default function Stepper({ steps, currentStep }) {
  return (
    <div className="stepper">
      {steps.map((label, index) => (
        <div
          key={label}
          className={`stepper-item ${index === currentStep ? 'active' : ''} ${index < currentStep ? 'done' : ''}`}
        >
          <span className="stepper-number">{index + 1}</span>
          <span className="stepper-label">{label}</span>
        </div>
      ))}
    </div>
  );
}
